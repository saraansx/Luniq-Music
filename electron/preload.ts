import { ipcRenderer, contextBridge } from 'electron'

// Track original listeners and their wrappers to prevent memory leaks
const listenerMap = new Map<string, Map<any, any>>();

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args;
    
    // Create a wrapper that correctly passes the event and arguments
    const wrapper = (event: any, ...args: any[]) => listener(event, ...args);
    
    // Store the wrapper in the map for future removal
    if (!listenerMap.has(channel)) {
      listenerMap.set(channel, new Map());
    }
    listenerMap.get(channel)!.set(listener, wrapper);
    
    ipcRenderer.on(channel, wrapper);

    // Return a cleanup function (useful for React's useEffect return)
    return () => {
      const currentWrapper = listenerMap.get(channel)?.get(listener);
      if (currentWrapper) {
        ipcRenderer.removeListener(channel, currentWrapper);
        listenerMap.get(channel)?.delete(listener);
      }
    };
  },
  
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, listener] = args;
    
    // Retrieve the wrapper associated with this listener
    const wrapper = listenerMap.get(channel)?.get(listener);
    if (wrapper) {
      ipcRenderer.off(channel, wrapper);
      listenerMap.get(channel)!.delete(listener);
    }
  },

  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },

  removeAllListeners(channel: string) {
    ipcRenderer.removeAllListeners(channel);
    listenerMap.delete(channel);
  },
})
