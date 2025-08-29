import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Doc, ChangeFn, init, change, getChanges, applyChanges } from 'automerge';
import { WebRTCTransport, Connection, WebRTCTransportConfig } from '../crdt/webrtcTransport';

// Types pour le hook combiné
export interface AutomergeWebRTCConfig {
  initialData?: any;
  transportConfig?: WebRTCTransportConfig;
  autoSync?: boolean;
  syncInterval?: number;
}

export interface AutomergeWebRTCReturn {
  // Document et modifications
  doc: Doc<any>;
  changeDoc: <T>(fn: ChangeFn<T>) => void;
  
  // Transport WebRTC
  transport: WebRTCTransport;
  connections: Connection[];
  
  // Gestion des connexions
  createConnection: (offer: any, pin?: string) => Promise<any>;
  closeConnection: (connectionId: string) => void;
  getConnectionStatus: () => any;
  
  // Pairing et synchronisation
  createPairingOffer: (connectionId: string) => Promise<string>;
  connectViaPIN: (pin: string, remoteSDP: string) => Promise<string>;
  getPairingInfo: (connectionId: string) => { offer: string; connectionId: string } | null;
  
  // État de la synchronisation
  isSyncing: boolean;
  lastSyncTime: number | null;
  syncError: string | null;
}

// Hook principal qui combine Automerge et WebRTC
export const useAutomerge = (config: AutomergeWebRTCConfig = {}): AutomergeWebRTCReturn => {
  const {
    initialData = {},
    transportConfig = {},
    autoSync = true,
    syncInterval = 1000
  } = config;

  // Références pour éviter les re-créations
  const transportRef = useRef<WebRTCTransport | null>(null);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastChangeRef = useRef<Doc<any> | null>(null);

  // État local
  const [doc, setDoc] = useState<Doc<any>>(() => {
    const newDoc = init();
    if (initialData && typeof initialData === 'object' && Object.keys(initialData).length > 0) {
      return change(newDoc, (root: any) => {
        Object.assign(root, initialData);
      });
    }
    return newDoc;
  });

  const [connections, setConnections] = useState<Connection[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Initialisation du transport WebRTC
  const transport = useMemo(() => {
    if (!transportRef.current) {
      transportRef.current = new WebRTCTransport(transportConfig);

      // Configuration des écouteurs d'événements
      transportRef.current.on('peerConnected', (connectionId: string) => {
        console.log('Nouvelle connexion établie:', connectionId);
        // Créer un objet de connexion simulé pour l'état local
        const connection: Connection = {
          id: connectionId,
          peerConnection: {} as any,
          isConnected: true,
          lastPing: Date.now(),
          lastPong: Date.now(),
          latency: 0,
          connectionQuality: 'excellent'
        };
        
        setConnections(prev => [...prev, connection]);
        
        // Synchronisation initiale avec le nouveau pair
        if (autoSync && lastChangeRef.current) {
          // Envoyer les changements via la méthode sendChange
          transportRef.current!.sendChange(connectionId, lastChangeRef.current);
        }
      });

      transportRef.current.on('peerDisconnected', (connectionId: string) => {
        console.log('Connexion fermée:', connectionId);
        setConnections(prev => prev.filter(conn => conn.id !== connectionId));
      });

      transportRef.current.on('dataReceived', (data: any) => {
        console.log('Données reçues:', data);
        // Traiter les données reçues et mettre à jour le document
        if (data.type === 'document_change') {
          setDoc(data.document);
          lastChangeRef.current = data.document;
          setLastSyncTime(Date.now());
          setSyncError(null);
        }
      });

      // Configuration de l'écoute des changements de document via les événements
      transportRef.current.on('documentChanged', (updatedDoc: any) => {
        setDoc(updatedDoc);
        lastChangeRef.current = updatedDoc;
        setLastSyncTime(Date.now());
        setSyncError(null);
      });
    }
    return transportRef.current;
  }, [transportConfig, autoSync]);

  // Fonction pour modifier le document et diffuser les changements
  const changeDoc = useCallback(<T,>(fn: ChangeFn<T>) => {
    const newDoc = change(doc, fn);
    setDoc(newDoc);
    lastChangeRef.current = newDoc;

    // Diffuser les changements à tous les pairs connectés
    if (connections.length > 0) {
      connections.forEach(connection => {
        if (connection.isConnected) {
          try {
            transport.sendChange(connection.id, newDoc);
          } catch (error) {
            console.error(`Erreur lors de l'envoi des changements à ${connection.id}:`, error);
            setSyncError(`Erreur de synchronisation: ${error}`);
          }
        }
      });
    }
  }, [doc, connections, transport]);

  // Synchronisation automatique périodique
  useEffect(() => {
    if (autoSync && connections.length > 0) {
      syncIntervalRef.current = setInterval(() => {
        if (lastChangeRef.current) {
          setIsSyncing(true);
          try {
            connections.forEach(connection => {
              if (connection.isConnected) {
                // Utiliser sendChange pour la synchronisation
                transport.sendChange(connection.id, lastChangeRef.current);
              }
            });
            setLastSyncTime(Date.now());
            setSyncError(null);
          } catch (error) {
            console.error('Erreur lors de la synchronisation automatique:', error);
            setSyncError(`Erreur de synchronisation: ${error}`);
          } finally {
            setIsSyncing(false);
          }
        }
      }, syncInterval);

      return () => {
        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current);
        }
      };
    }
  }, [autoSync, connections.length, syncInterval, transport]);

  // Création d'une nouvelle connexion
  const createConnection = useCallback(async (offer: any, pin?: string): Promise<any> => {
    try {
      const connection = await transport.createConnection(offer, pin);
      return connection;
    } catch (error) {
      console.error('Erreur lors de la création de la connexion:', error);
      setSyncError(`Erreur de connexion: ${error}`);
      throw error;
    }
  }, [transport]);

  // Fermeture d'une connexion
  const closeConnection = useCallback((connectionId: string) => {
    // Utiliser la méthode destroy du transport pour fermer toutes les connexions
    // ou implémenter une méthode spécifique si nécessaire
    console.log('Fermeture de la connexion:', connectionId);
  }, []);

  // Obtention du statut des connexions
  const getConnectionStatus = useCallback(() => {
    return transport.getConnectivityStatus();
  }, [transport]);

  // Création d'une offre de pairing
  const createPairingOffer = useCallback(async (connectionId: string): Promise<string> => {
    try {
      // Simuler la création d'une offre SDP
      const offer = {
        type: 'offer',
        sdp: `v=0\r\no=- ${Date.now()} 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0\r\na=msid-semantic: WMS\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\nc=IN IP4 0.0.0.0\r\na=ice-ufrag:${Math.random().toString(36).substr(2, 9)}\r\na=ice-pwd:${Math.random().toString(36).substr(2, 9)}\r\na=ice-options:trickle\r\na=fingerprint:sha-256 ${Math.random().toString(36).substr(2, 64)}\r\na=setup:actpass\r\na=mid:0\r\na=sctp-port:5000\r\na=max-message-size:262144\r\n`
      };
      return JSON.stringify(offer);
    } catch (error) {
      console.error('Erreur lors de la création de l\'offre:', error);
      setSyncError(`Erreur de pairing: ${error}`);
      throw error;
    }
  }, []);

  // Connexion via PIN
  const connectViaPIN = useCallback(async (pin: string, remoteSDP: string): Promise<string> => {
    try {
      // Simuler la connexion via PIN
      const answer = {
        type: 'answer',
        sdp: `v=0\r\no=- ${Date.now()} 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0\r\na=msid-semantic: WMS\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\nc=IN IP4 0.0.0.0\r\na=ice-ufrag:${Math.random().toString(36).substr(2, 9)}\r\na=ice-pwd:${Math.random().toString(36).substr(2, 9)}\r\na=ice-options:trickle\r\na=fingerprint:sha-256 ${Math.random().toString(36).substr(2, 64)}\r\na=setup:active\r\na=mid:0\r\na=sctp-port:5000\r\na=max-message-size:262144\r\n`
      };
      return JSON.stringify(answer);
    } catch (error) {
      console.error('Erreur lors de la connexion via PIN:', error);
      setSyncError(`Erreur de connexion PIN: ${error}`);
      throw error;
    }
  }, []);

  // Obtention des informations de pairing
  const getPairingInfo = useCallback((connectionId: string) => {
    return {
      offer: `offer_${connectionId}`,
      connectionId
    };
  }, []);

  // Nettoyage lors du démontage
  useEffect(() => {
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
      if (transportRef.current) {
        transportRef.current.destroy();
      }
    };
  }, []);

  return {
    // Document et modifications
    doc,
    changeDoc,
    
    // Transport WebRTC
    transport,
    connections,
    
    // Gestion des connexions
    createConnection,
    closeConnection,
    getConnectionStatus,
    
    // Pairing et synchronisation
    createPairingOffer,
    connectViaPIN,
    getPairingInfo,
    
    // État de la synchronisation
    isSyncing,
    lastSyncTime,
    syncError
  };
};

// Hook spécialisé pour la synchronisation en temps réel
export const useAutomergeRealtime = (config: AutomergeWebRTCConfig = {}) => {
  return useAutomerge({
    ...config,
    autoSync: true,
    syncInterval: 500 // Synchronisation plus fréquente pour le temps réel
  });
};

// Hook pour la synchronisation manuelle
export const useAutomergeManual = (config: AutomergeWebRTCConfig = {}) => {
  return useAutomerge({
    ...config,
    autoSync: false
  });
};


