import * as React from 'react';
import { Doc, ChangeFn, init, change } from 'automerge';

// Type pour le contexte Automerge
interface AutomergeContextType {
  doc: Doc<any>;
  changeDoc: <T>(fn: ChangeFn<T>) => void;
}

// Création du contexte
const AutomergeContext = React.createContext<AutomergeContextType | null>(null);

// Props pour le provider
interface AutomergeProviderProps {
  children: React.ReactNode;
  initialData?: any;
}

// Hook personnalisé useAutomerge
export const useAutomerge = () => {
  const context = React.useContext(AutomergeContext);
  if (!context) {
    throw new Error('useAutomerge doit être utilisé à l\'intérieur d\'un AutomergeProvider');
  }
  return context;
};

// Provider du contexte Automerge
export const AutomergeProvider: React.FC<AutomergeProviderProps> = ({ 
  children, 
  initialData = {} 
}) => {
  // Initialisation du document Automerge
  const [doc, setDoc] = React.useState<Doc<any>>(() => {
    const newDoc = init();
    // Appliquer les données initiales si fournies
    if (Object.keys(initialData).length > 0) {
      return change(newDoc, (root: any) => {
        Object.assign(root, initialData);
      });
    }
    return newDoc;
  });

  // Fonction pour modifier le document
  const changeDoc = React.useCallback(<T,>(fn: ChangeFn<T>) => {
    const newDoc = change(doc, fn);
    setDoc(newDoc);
  }, [doc]);

  // Écouter les mises à jour du document
  React.useEffect(() => {
    // Ici, vous pouvez ajouter la logique pour écouter les mises à jour
    // par exemple, via WebRTC, WebSocket, ou d'autres mécanismes de synchronisation
    
    // Exemple de logique d'écoute (à adapter selon vos besoins)
    const handleDocumentUpdate = (updatedDoc: Doc<any>) => {
      setDoc(updatedDoc);
    };

    // Retourner une fonction de nettoyage si nécessaire
    return () => {
      // Nettoyage des listeners si nécessaire
    };
  }, []);

  const contextValue: AutomergeContextType = {
    doc,
    changeDoc,
  };

  return React.createElement(
    AutomergeContext.Provider,
    { value: contextValue },
    children
  );
};

// Fonction utilitaire pour créer un document avec des données initiales
export const createAutomergeDoc = <T>(initialData: T): Doc<T> => {
  const doc = init<T>();
  return change(doc, (root: any) => {
    Object.assign(root, initialData);
  });
};

// Fonction utilitaire pour obtenir la racine du document
export const getDocumentRoot = <T>(doc: Doc<T>) => {
  return doc as T;
};

// Export des types pour une utilisation externe
export type { Doc, ChangeFn };
export { init };
