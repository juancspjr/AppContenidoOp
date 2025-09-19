/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';

interface HealthStatusBannerProps {
  isConnectionHealthy: boolean;
  onReconnect: () => void;
}

const HealthStatusBanner: React.FC<HealthStatusBannerProps> = ({ isConnectionHealthy, onReconnect }) => {
  if (isConnectionHealthy) {
    return null; // Don't render anything if the connection is fine
  }

  return (
    <div 
        className="fixed top-4 left-1/2 -translate-x-1/2 w-full max-w-xl z-50 p-4 bg-red-800/90 border border-red-600 rounded-lg shadow-2xl text-white text-center animate-fade-in backdrop-blur-sm"
        role="alert"
    >
      <h3 className="font-bold text-lg">⚠️ ¡Conexión de Generación Ilimitada Perdida!</h3>
      <p className="text-sm mb-3">
        La conexión con el servicio de Gemini Web ha expirado o fallado. Las generaciones de imágenes podrían ser lentas o fallar.
      </p>
      <button 
        onClick={onReconnect}
        className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg transition-colors"
      >
        Intentar Reconectar
      </button>
    </div>
  );
};

export default HealthStatusBanner;
