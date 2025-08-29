import { Doc, ChangeFn, init, change, applyChanges, getChanges } from 'automerge';
import { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } from 'react-native-webrtc';

// Types pour la gestion offline
interface QueuedChange {
  id: string;
  timestamp: Date;
  changeData: any;
  retryCount: number;
  maxRetries: number;
  priority: 'high' | 'normal' | 'low';
  metadata?: {
    orderId?: string;
    tableId?: string;
    changeType?: string;
    [key: string]: any;
  };
}

// Types pour la sécurité
interface SessionSecurity {
  pin: string;
  maxPeers: number;
  allowPeerRemoval: boolean;
  requirePinForRejoin: boolean;
  sessionTimeout: number; // en millisecondes
  maxFailedAttempts: number;
}

interface PeerInfo {
  id: string;
  name?: string;
  deviceInfo?: string;
  ipAddress?: string;
  joinedAt: Date;
  lastActivity: Date;
  failedAttempts: number;
  isBlocked: boolean;
  permissions: PeerPermissions;
}

interface PeerPermissions {
  canRead: boolean;
  canWrite: boolean;
  canRemovePeers: boolean;
  canManageSession: boolean;
  canViewLogs: boolean;
}

interface SecurityEvent {
  type: 'peer_joined' | 'peer_left' | 'peer_removed' | 'pin_attempt' | 'security_violation';
  peerId: string;
  timestamp: Date;
  details: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

interface Connection {
  id: string;
  peerConnection: RTCPeerConnection;
  dataChannel?: any; // RTCDataChannel
  isConnected: boolean;
  lastPing: number;
  lastPong: number;
  latency: number;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'disconnected';
}

interface WebRTCTransportConfig {
  enableOfflineQueue?: boolean;
  maxQueueSize?: number;
  maxRetries?: number;
  retryDelay?: number;
  enablePriorityQueue?: boolean;
  enableConnectionQuality?: boolean;
  heartbeatInterval?: number;
  connectionTimeout?: number;
  // Sécurité
  security?: SessionSecurity;
  enableSecurityLogs?: boolean;
  enablePeerValidation?: boolean;
}

export class WebRTCTransport {
  private connections: Map<string, Connection> = new Map();
  private localDoc: Doc<any> | null = null;
  private isOnline: boolean = false;
  private lastOnlineCheck: number = Date.now();
  
  // Gestion offline
  private offlineQueue: QueuedChange[] = [];
  private isFlushing: boolean = false;
  private flushRetryTimeout?: NodeJS.Timeout;
  private config: WebRTCTransportConfig;
  
  // Sécurité
  private sessionSecurity: SessionSecurity;
  private peerInfo: Map<string, PeerInfo> = new Map();
  private securityEvents: SecurityEvent[] = [];
  private blockedPeers: Set<string> = new Set();
  private sessionStartTime: number = Date.now();
  
  // Événements
  private eventListeners: Map<string, Set<Function>> = new Map();
  
  // Métriques de connexion
  private connectionMetrics = {
    totalChangesSent: 0,
    totalChangesReceived: 0,
    failedChanges: 0,
    averageLatency: 0,
    lastSyncTime: 0,
  };

  constructor(config: WebRTCTransportConfig = {}) {
    this.config = {
      enableOfflineQueue: true,
      maxQueueSize: 1000,
      maxRetries: 3,
      retryDelay: 5000,
      enablePriorityQueue: true,
      enableConnectionQuality: true,
      heartbeatInterval: 30000,
      connectionTimeout: 60000,
      enableSecurityLogs: true,
      enablePeerValidation: true,
      ...config,
    };

    // Configuration de sécurité par défaut
    this.sessionSecurity = {
      pin: config.security?.pin || this.generateSecurePin(),
      maxPeers: config.security?.maxPeers || 10,
      allowPeerRemoval: config.security?.allowPeerRemoval ?? true,
      requirePinForRejoin: config.security?.requirePinForRejoin ?? true,
      sessionTimeout: config.security?.sessionTimeout || 24 * 60 * 60 * 1000, // 24h
      maxFailedAttempts: config.security?.maxFailedAttempts || 3,
      ...config.security,
    };

    // Démarrer la surveillance de la connectivité
    this.startConnectivityMonitoring();
    
    // Démarrer le heartbeat
    this.startHeartbeat();
    
    // Démarrer la surveillance de sécurité
    this.startSecurityMonitoring();
  }

  // === SÉCURITÉ ===

  /**
   * Générer un PIN sécurisé
   */
  private generateSecurePin(): string {
    // Générer un PIN à 6 chiffres
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Démarrer la surveillance de sécurité
   */
  private startSecurityMonitoring(): void {
    // Vérifier la validité de la session toutes les minutes
    setInterval(() => {
      this.checkSessionValidity();
    }, 60000);

    // Nettoyer les anciens événements de sécurité toutes les heures
    setInterval(() => {
      this.cleanupSecurityEvents();
    }, 60 * 60 * 1000);
  }

  /**
   * Vérifier la validité de la session
   */
  private checkSessionValidity(): void {
    const now = Date.now();
    const sessionAge = now - this.sessionStartTime;

    if (sessionAge > this.sessionSecurity.sessionTimeout) {
      console.warn('Session expirée, déconnexion de tous les peers');
      this.expireSession();
    }
  }

  /**
   * Expirer la session
   */
  private expireSession(): void {
    // Déconnecter tous les peers
    this.connections.forEach((connection, peerId) => {
      this.removePeer(peerId, 'Session expirée');
    });

    // Réinitialiser la session
    this.sessionStartTime = Date.now();
    this.sessionSecurity.pin = this.generateSecurePin();
    
    this.logSecurityEvent('security_violation', 'system', 'Session expirée et renouvelée', 'warning');
    this.emit('sessionExpired');
  }

  /**
   * Valider le PIN d'un peer
   */
  validatePin(pin: string): boolean {
    const isValid = pin === this.sessionSecurity.pin;
    
    if (!isValid) {
      this.logSecurityEvent('pin_attempt', 'unknown', 'Tentative de connexion avec PIN invalide', 'warning');
    }

    return isValid;
  }

  /**
   * Ajouter un peer avec validation
   */
  addPeer(peerId: string, pin: string, peerInfo?: Partial<PeerInfo>): boolean {
    // Vérifier le PIN
    if (!this.validatePin(pin)) {
      return false;
    }

    // Vérifier si le peer est bloqué
    if (this.blockedPeers.has(peerId)) {
      this.logSecurityEvent('security_violation', peerId, 'Tentative de connexion d\'un peer bloqué', 'error');
      return false;
    }

    // Vérifier la limite de peers
    if (this.peerInfo.size >= this.sessionSecurity.maxPeers) {
      this.logSecurityEvent('security_violation', peerId, 'Limite de peers atteinte', 'warning');
      return false;
    }

    // Créer les informations du peer
    const peer: PeerInfo = {
      id: peerId,
      name: peerInfo?.name || `Peer-${peerId.slice(-4)}`,
      deviceInfo: peerInfo?.deviceInfo || 'Unknown',
      ipAddress: peerInfo?.ipAddress,
      joinedAt: new Date(),
      lastActivity: new Date(),
      failedAttempts: 0,
      isBlocked: false,
      permissions: {
        canRead: true,
        canWrite: true,
        canRemovePeers: false,
        canManageSession: false,
        canViewLogs: false,
        ...peerInfo?.permissions,
      },
    };

    this.peerInfo.set(peerId, peer);
    this.logSecurityEvent('peer_joined', peerId, 'Peer connecté avec succès', 'info');
    
    return true;
  }

  /**
   * Retirer un peer
   */
  removePeer(peerId: string, reason: string = 'Retrait manuel'): boolean {
    const peer = this.peerInfo.get(peerId);
    if (!peer) {
      return false;
    }

    // Vérifier les permissions
    const currentPeer = this.getCurrentPeerInfo();
    if (currentPeer && !currentPeer.permissions.canRemovePeers) {
      this.logSecurityEvent('security_violation', currentPeer.id, 'Tentative de retrait sans permission', 'error');
      return false;
    }

    // Fermer la connexion
    const connection = this.connections.get(peerId);
    if (connection) {
      try {
        connection.peerConnection.close();
        this.connections.delete(peerId);
      } catch (error) {
        console.warn('Erreur lors de la fermeture de la connexion:', error);
      }
    }

    // Supprimer les informations du peer
    this.peerInfo.delete(peerId);
    this.blockedPeers.delete(peerId);

    this.logSecurityEvent('peer_removed', peerId, reason, 'info');
    this.emit('peerRemoved', { peerId, reason });

    // Vérifier la connectivité
    this.checkConnectivity();

    return true;
  }

  /**
   * Bloquer un peer
   */
  blockPeer(peerId: string, reason: string = 'Violation de sécurité'): boolean {
    const peer = this.peerInfo.get(peerId);
    if (!peer) {
      return false;
    }

    // Vérifier les permissions
    const currentPeer = this.getCurrentPeerInfo();
    if (currentPeer && !currentPeer.permissions.canManageSession) {
      this.logSecurityEvent('security_violation', currentPeer.id, 'Tentative de blocage sans permission', 'error');
      return false;
    }

    // Bloquer le peer
    this.blockedPeers.add(peerId);
    peer.isBlocked = true;
    peer.failedAttempts = this.sessionSecurity.maxFailedAttempts;

    this.logSecurityEvent('security_violation', peerId, `Peer bloqué: ${reason}`, 'critical');
    this.emit('peerBlocked', { peerId, reason });

    // Retirer le peer
    this.removePeer(peerId, `Bloqué: ${reason}`);

    return true;
  }

  /**
   * Obtenir les informations du peer actuel
   */
  private getCurrentPeerInfo(): PeerInfo | null {
    // Pour l'instant, retourner null (sera implémenté selon la logique d'identification)
    return null;
  }

  /**
   * Logger un événement de sécurité
   */
  private logSecurityEvent(
    type: SecurityEvent['type'],
    peerId: string,
    details: string,
    severity: SecurityEvent['severity']
  ): void {
    if (!this.config.enableSecurityLogs) return;

    const event: SecurityEvent = {
      type,
      peerId,
      timestamp: new Date(),
      details,
      severity,
    };

    this.securityEvents.push(event);
    
    // Limiter le nombre d'événements stockés
    if (this.securityEvents.length > 1000) {
      this.securityEvents = this.securityEvents.slice(-500);
    }

    this.emit('securityEvent', event);
  }

  /**
   * Nettoyer les anciens événements de sécurité
   */
  private cleanupSecurityEvents(): void {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    this.securityEvents = this.securityEvents.filter(
      event => event.timestamp.getTime() > oneDayAgo
    );
  }

  /**
   * Obtenir le PIN de la session
   */
  getSessionPin(): string {
    return this.sessionSecurity.pin;
  }

  /**
   * Changer le PIN de la session
   */
  changeSessionPin(newPin: string): boolean {
    const currentPeer = this.getCurrentPeerInfo();
    if (currentPeer && !currentPeer.permissions.canManageSession) {
      this.logSecurityEvent('security_violation', currentPeer.id, 'Tentative de changement de PIN sans permission', 'error');
      return false;
    }

    this.sessionSecurity.pin = newPin;
    this.logSecurityEvent('security_violation', 'system', 'PIN de session changé', 'info');
    this.emit('pinChanged', newPin);
    
    return true;
  }

  /**
   * Obtenir les informations de sécurité
   */
  getSecurityInfo(): {
    sessionPin: string;
    maxPeers: number;
    currentPeers: number;
    allowPeerRemoval: boolean;
    requirePinForRejoin: boolean;
    sessionAge: number;
    sessionTimeout: number;
    blockedPeers: number;
    securityEvents: SecurityEvent[];
  } {
    return {
      sessionPin: this.sessionSecurity.pin,
      maxPeers: this.sessionSecurity.maxPeers,
      currentPeers: this.peerInfo.size,
      allowPeerRemoval: this.sessionSecurity.allowPeerRemoval,
      requirePinForRejoin: this.sessionSecurity.requirePinForRejoin,
      sessionAge: Date.now() - this.sessionStartTime,
      sessionTimeout: this.sessionSecurity.sessionTimeout,
      blockedPeers: this.blockedPeers.size,
      securityEvents: [...this.securityEvents],
    };
  }

  // === GESTION OFFLINE ===

  /**
   * Ajouter un changement à la queue offline
   */
  private addToOfflineQueue(changeData: any, priority: 'high' | 'normal' | 'low' = 'normal', metadata?: any): void {
    if (!this.config.enableOfflineQueue) {
      console.warn('Queue offline désactivée, changement ignoré');
      return;
    }

    // Vérifier la taille de la queue
    if (this.offlineQueue.length >= this.config.maxQueueSize!) {
      // Supprimer les changements de plus faible priorité
      this.cleanupOfflineQueue();
      
      if (this.offlineQueue.length >= this.config.maxQueueSize!) {
        console.error('Queue offline pleine, changement ignoré');
        return;
      }
    }

    const queuedChange: QueuedChange = {
      id: `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      changeData,
      retryCount: 0,
      maxRetries: this.config.maxRetries!,
      priority,
      metadata,
    };

    // Insérer selon la priorité si activée
    if (this.config.enablePriorityQueue) {
      this.insertPriorityChange(queuedChange);
    } else {
      this.offlineQueue.push(queuedChange);
    }

    console.log(`Changement ajouté à la queue offline (${priority}):`, queuedChange.id);
    this.emit('changeQueued', queuedChange);
  }

  /**
   * Insérer un changement selon sa priorité
   */
  private insertPriorityChange(change: QueuedChange): void {
    const priorities = { high: 0, normal: 1, low: 2 };
    
    let insertIndex = this.offlineQueue.length;
    for (let i = 0; i < this.offlineQueue.length; i++) {
      if (priorities[this.offlineQueue[i].priority] > priorities[change.priority]) {
        insertIndex = i;
        break;
      }
    }
    
    this.offlineQueue.splice(insertIndex, 0, change);
  }

  /**
   * Nettoyer la queue offline (supprimer les changements de faible priorité)
   */
  private cleanupOfflineQueue(): void {
    if (this.offlineQueue.length === 0) return;

    // Garder les changements de haute priorité
    const highPriorityChanges = this.offlineQueue.filter(c => c.priority === 'high');
    
    // Garder les changements récents de priorité normale
    const recentNormalChanges = this.offlineQueue
      .filter(c => c.priority === 'normal')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, Math.floor(this.config.maxQueueSize! * 0.3));

    // Supprimer les changements de faible priorité et anciens
    this.offlineQueue = [...highPriorityChanges, ...recentNormalChanges];
    
    console.log(`Queue offline nettoyée, ${this.offlineQueue.length} changements conservés`);
  }

  /**
   * Flusher la queue offline vers tous les peers connectés
   */
  private async flushOfflineQueue(): Promise<void> {
    if (this.isFlushing || this.offlineQueue.length === 0 || !this.hasConnectedPeers()) {
      return;
    }

    this.isFlushing = true;
    console.log(`Début du flush de la queue offline (${this.offlineQueue.length} changements)`);

    const connectedConnections = Array.from(this.connections.values()).filter(c => c.isConnected);
    const changesToFlush = [...this.offlineQueue];
    let successfulFlushes = 0;
    let failedFlushes = 0;

    for (const change of changesToFlush) {
      try {
        let changeSent = false;
        
        // Essayer d'envoyer à tous les peers connectés
        for (const connection of connectedConnections) {
          try {
            await this.sendChangeToPeer(connection.id, change.changeData);
            changeSent = true;
            break; // Un seul peer suffit
          } catch (error) {
            console.warn(`Échec envoi à ${connection.id}:`, error);
            continue;
          }
        }

        if (changeSent) {
          // Supprimer de la queue
          this.offlineQueue = this.offlineQueue.filter(c => c.id !== change.id);
          successfulFlushes++;
          
          this.emit('changeFlushed', change);
        } else {
          // Incrémenter le compteur de tentatives
          change.retryCount++;
          
          if (change.retryCount >= change.maxRetries) {
            // Supprimer après trop de tentatives
            this.offlineQueue = this.offlineQueue.filter(c => c.id !== change.id);
            failedFlushes++;
            
            this.emit('changeFailed', change);
            console.error(`Changement ${change.id} échoué après ${change.maxRetries} tentatives`);
          }
        }
      } catch (error) {
        console.error(`Erreur lors du flush du changement ${change.id}:`, error);
        change.retryCount++;
      }
    }

    this.isFlushing = false;
    console.log(`Flush terminé: ${successfulFlushes} succès, ${failedFlushes} échecs, ${this.offlineQueue.length} restants`);

    // Programmer un nouveau flush si il reste des changements
    if (this.offlineQueue.length > 0) {
      this.scheduleFlushRetry();
    }
  }

  /**
   * Programmer une nouvelle tentative de flush
   */
  private scheduleFlushRetry(): void {
    if (this.flushRetryTimeout) {
      clearTimeout(this.flushRetryTimeout);
    }

    this.flushRetryTimeout = setTimeout(() => {
      this.flushOfflineQueue();
    }, this.config.retryDelay);
  }

  /**
   * Vérifier si des peers sont connectés
   */
  private hasConnectedPeers(): boolean {
    return Array.from(this.connections.values()).some(c => c.isConnected);
  }

  // === SURVEILLANCE DE LA CONNECTIVITÉ ===

  /**
   * Démarrer la surveillance de la connectivité
   */
  private startConnectivityMonitoring(): void {
    // Vérifier la connectivité toutes les 10 secondes
    setInterval(() => {
      this.checkConnectivity();
    }, 10000);
  }

  /**
   * Vérifier l'état de la connectivité
   */
  private checkConnectivity(): void {
    const wasOnline = this.isOnline;
    const hasConnections = this.hasConnectedPeers();
    
    this.isOnline = hasConnections;
    this.lastOnlineCheck = Date.now();

    if (!wasOnline && this.isOnline) {
      // Passage en ligne
      console.log('🟢 Passage en ligne détecté');
      this.emit('online');
      this.flushOfflineQueue();
    } else if (wasOnline && !this.isOnline) {
      // Passage hors ligne
      console.log('🔴 Passage hors ligne détecté');
      this.emit('offline');
    }

    // Mettre à jour la qualité de connexion
    if (this.config.enableConnectionQuality) {
      this.updateConnectionQuality();
    }
  }

  /**
   * Mettre à jour la qualité de connexion
   */
  private updateConnectionQuality(): void {
    this.connections.forEach((connection, id) => {
      const now = Date.now();
      const latency = now - connection.lastPing;
      
      if (latency < 100) {
        connection.connectionQuality = 'excellent';
      } else if (latency < 300) {
        connection.connectionQuality = 'good';
      } else if (latency < 1000) {
        connection.connectionQuality = 'poor';
      } else {
        connection.connectionQuality = 'disconnected';
        connection.isConnected = false;
      }

      connection.latency = latency;
    });
  }

  // === HEARTBEAT ET PING ===

  /**
   * Démarrer le heartbeat
   */
  private startHeartbeat(): void {
    setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval);
  }

  /**
   * Envoyer un heartbeat à tous les peers
   */
  private sendHeartbeat(): void {
    const now = Date.now();
    
    this.connections.forEach((connection, id) => {
      if (connection.isConnected && connection.dataChannel) {
        try {
          connection.lastPing = now;
          
          const heartbeatMessage = {
            type: 'heartbeat',
            timestamp: now,
            connectionId: id,
          };

          connection.dataChannel.send(JSON.stringify(heartbeatMessage));
        } catch (error) {
          console.warn(`Erreur heartbeat vers ${id}:`, error);
          connection.isConnected = false;
        }
      }
    });
  }

  /**
   * Traiter un heartbeat reçu
   */
  private handleHeartbeat(message: any, connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const now = Date.now();
    connection.lastPong = now;
    
    // Calculer la latence
    if (connection.lastPing > 0) {
      connection.latency = now - connection.lastPing;
    }

    // Répondre au heartbeat
    try {
      const pongMessage = {
        type: 'pong',
        timestamp: now,
        connectionId,
        receivedAt: message.timestamp,
      };

      connection.dataChannel?.send(JSON.stringify(pongMessage));
    } catch (error) {
      console.warn(`Erreur pong vers ${connectionId}:`, error);
    }
  }

  // === MÉTHODES PUBLIQUES MODIFIÉES ===

  /**
   * Envoyer un changement (avec gestion offline)
   */
  async sendChange(connectionId: string, changeData: any, priority: 'high' | 'normal' | 'low' = 'normal', metadata?: any): Promise<void> {
    try {
      if (this.isOnline && this.connections.has(connectionId)) {
        // Envoi direct si en ligne
        await this.sendChangeToPeer(connectionId, changeData);
        this.connectionMetrics.totalChangesSent++;
        this.connectionMetrics.lastSyncTime = Date.now();
      } else {
        // Ajouter à la queue offline
        this.addToOfflineQueue(changeData, priority, metadata);
        console.log(`Changement mis en queue offline (priorité: ${priority})`);
      }
    } catch (error) {
      console.error('Erreur lors de l\'envoi du changement:', error);
      
      // Ajouter à la queue offline en cas d'erreur
      this.addToOfflineQueue(changeData, 'high', metadata);
      this.connectionMetrics.failedChanges++;
    }
  }

  /**
   * Envoyer un changement à un peer spécifique
   */
  private async sendChangeToPeer(connectionId: string, changeData: any): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.isConnected || !connection.dataChannel) {
      throw new Error(`Connexion ${connectionId} non disponible`);
    }

    const message = {
      type: 'change',
      data: changeData,
      timestamp: Date.now(),
      connectionId,
    };

    connection.dataChannel.send(JSON.stringify(message));
  }

  /**
   * Créer une connexion avec gestion de la queue et validation de sécurité
   */
  async createConnection(offer: RTCSessionDescription, pin?: string, peerInfo?: Partial<PeerInfo>): Promise<RTCSessionDescription> {
    // Validation du PIN si fourni
    if (pin && !this.validatePin(pin)) {
      throw new Error('PIN invalide');
    }

    const connection = await this.setupPeerConnection(offer);
    
    // Ajouter le peer avec validation de sécurité
    if (peerInfo) {
      const peerAdded = this.addPeer(connection.id, pin || this.sessionSecurity.pin, peerInfo);
      if (!peerAdded) {
        // Fermer la connexion si l'ajout échoue
        connection.peerConnection.close();
        throw new Error('Échec de l\'ajout du peer (limite atteinte ou peer bloqué)');
      }
    }
    
    // Vérifier la connectivité
    this.checkConnectivity();
    
    // Flusher la queue si c'est la première connexion
    if (this.connections.size === 1) {
      setTimeout(() => this.flushOfflineQueue(), 1000);
    }

    return connection.answer;
  }

  /**
   * Configurer une connexion peer-to-peer
   */
  private async setupPeerConnection(offer: RTCSessionDescription): Promise<{
    id: string;
    peerConnection: RTCPeerConnection;
    answer: RTCSessionDescription;
  }> {
    const connectionId = `peer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Créer la connexion peer
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    // Créer le canal de données
    const dataChannel = peerConnection.createDataChannel('crdt-sync', {
      ordered: true,
      maxRetransmits: 3
    });

    // Créer l'objet de connexion
    const connection: Connection = {
      id: connectionId,
      peerConnection,
      dataChannel,
      isConnected: false,
      lastPing: 0,
      lastPong: 0,
      latency: 0,
      connectionQuality: 'disconnected'
    };

    // Configurer les gestionnaires d'événements
    this.setupDataChannelHandlers(dataChannel, connectionId);
    this.setupPeerConnectionHandlers(peerConnection, connectionId);

    // Traiter l'offre SDP
    await peerConnection.setRemoteDescription(offer);
    
    // Créer la réponse
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    // Ajouter la connexion à la Map
    this.connections.set(connectionId, connection);
    
    // Marquer comme connecté une fois le canal de données ouvert
    (dataChannel as any).onopen = () => {
      connection.isConnected = true;
      connection.connectionQuality = 'excellent';
      this.emit('peerConnected', connectionId);
      console.log(`Canal de données ouvert avec ${connectionId}`);
    };

    (dataChannel as any).onclose = () => {
      this.handlePeerDisconnection(connectionId);
    };

    return {
      id: connectionId,
      peerConnection,
      answer
    };
  }

  /**
   * Configurer les gestionnaires du canal de données
   */
  private setupDataChannelHandlers(dataChannel: any, connectionId: string): void {
    dataChannel.onmessage = (event: any) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message, connectionId);
      } catch (error) {
        console.error('Erreur lors du parsing du message:', error);
      }
    };

    dataChannel.onerror = (error: any) => {
      console.error(`Erreur sur le canal de données ${connectionId}:`, error);
      this.handlePeerDisconnection(connectionId);
    };
  }

  /**
   * Configurer les gestionnaires de la connexion peer
   */
  private setupPeerConnectionHandlers(peerConnection: RTCPeerConnection, connectionId: string): void {
    // Utiliser la syntaxe appropriée pour react-native-webrtc
    (peerConnection as any).onicecandidate = (event: any) => {
      if (event.candidate) {
        console.log('Candidat ICE généré:', event.candidate);
      }
    };

    (peerConnection as any).onconnectionstatechange = () => {
      console.log(`État de la connexion ${connectionId}:`, (peerConnection as any).connectionState);
      
      if ((peerConnection as any).connectionState === 'failed' || (peerConnection as any).connectionState === 'disconnected') {
        this.handlePeerDisconnection(connectionId);
      }
    };

    (peerConnection as any).oniceconnectionstatechange = () => {
      console.log(`État ICE de la connexion ${connectionId}:`, (peerConnection as any).iceConnectionState);
    };
  }

  /**
   * Traiter les messages reçus
   */
  private handleMessage(message: any, connectionId: string): void {
    switch (message.type) {
      case 'change':
        this.handleChangeMessage(message, connectionId);
        break;
      case 'heartbeat':
        this.handleHeartbeat(message, connectionId);
        break;
      case 'pong':
        this.handlePongMessage(message, connectionId);
        break;
      default:
        console.warn('Type de message inconnu:', message.type);
    }
  }

  /**
   * Traiter un message de changement CRDT
   */
  private handleChangeMessage(message: any, connectionId: string): void {
    try {
      if (this.localDoc) {
        // Appliquer les changements au document local
        this.localDoc = applyChanges(this.localDoc, message.data);
        this.connectionMetrics.totalChangesReceived++;
        this.emit('changeReceived', { connectionId, data: message.data });
      }
    } catch (error) {
      console.error('Erreur lors de l\'application des changements:', error);
    }
  }

  /**
   * Traiter un message pong
   */
  private handlePongMessage(message: any, connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const now = Date.now();
    connection.lastPong = now;
    
    // Calculer la latence
    if (connection.lastPing > 0) {
      connection.latency = now - connection.lastPing;
    }
  }

  /**
   * Gérer la déconnexion d'un peer
   */
  private handlePeerDisconnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.isConnected = false;
      connection.connectionQuality = 'disconnected';
      
      console.log(`Peer ${connectionId} déconnecté`);
      this.emit('peerDisconnected', connectionId);
      
      // Vérifier la connectivité globale
      this.checkConnectivity();
    }
  }

  // === MÉTHODES UTILITAIRES ===

  /**
   * Obtenir l'état de la connectivité
   */
  getConnectivityStatus(): {
    isOnline: boolean;
    connectedPeers: number;
    totalPeers: number;
    queueSize: number;
    lastOnlineCheck: number;
    connectionQuality: 'excellent' | 'good' | 'poor' | 'disconnected';
  } {
    const connectedPeers = Array.from(this.connections.values()).filter(c => c.isConnected).length;
    const totalPeers = this.connections.size;
    
    let overallQuality: 'excellent' | 'good' | 'poor' | 'disconnected' = 'disconnected';
    if (connectedPeers > 0) {
      const qualities = Array.from(this.connections.values())
        .filter(c => c.isConnected)
        .map(c => c.connectionQuality);
      
      if (qualities.some(q => q === 'excellent')) overallQuality = 'excellent';
      else if (qualities.some(q => q === 'good')) overallQuality = 'good';
      else if (qualities.some(q => q === 'poor')) overallQuality = 'poor';
    }

    return {
      isOnline: this.isOnline,
      connectedPeers,
      totalPeers,
      queueSize: this.offlineQueue.length,
      lastOnlineCheck: this.lastOnlineCheck,
      connectionQuality: overallQuality,
    };
  }

  /**
   * Obtenir les métriques de connexion
   */
  getConnectionMetrics() {
    return { ...this.connectionMetrics };
  }

  /**
   * Vider manuellement la queue offline
   */
  async clearOfflineQueue(): Promise<void> {
    const queueSize = this.offlineQueue.length;
    this.offlineQueue = [];
    
    console.log(`Queue offline vidée manuellement (${queueSize} changements supprimés)`);
    this.emit('queueCleared', queueSize);
  }

  /**
   * Obtenir les changements en queue
   */
  getQueuedChanges(): QueuedChange[] {
    return [...this.offlineQueue];
  }

  // === GESTION DES ÉVÉNEMENTS ===

  on(event: string, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  off(event: string, listener: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Erreur dans l'écouteur d'événement ${event}:`, error);
        }
      });
    }
  }

  // === NETTOYAGE ===

  destroy(): void {
    // Nettoyer les timeouts
    if (this.flushRetryTimeout) {
      clearTimeout(this.flushRetryTimeout);
    }

    // Fermer toutes les connexions
    this.connections.forEach(connection => {
      try {
        connection.peerConnection.close();
      } catch (error) {
        console.warn('Erreur lors de la fermeture de la connexion:', error);
      }
    });

    // Vider la queue
    this.offlineQueue = [];
    
    // Nettoyer les données de sécurité
    this.peerInfo.clear();
    this.securityEvents = [];
    this.blockedPeers.clear();
    
    // Nettoyer les écouteurs
    this.eventListeners.clear();
    
    console.log('WebRTCTransport détruit');
  }
}

// Export des types pour utilisation externe
export type { 
  QueuedChange, 
  Connection, 
  WebRTCTransportConfig,
  SessionSecurity,
  PeerInfo,
  PeerPermissions,
  SecurityEvent
};


