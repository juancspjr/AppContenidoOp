/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * Un caché singleton en memoria para gestionar objetos Blob (imágenes, videos, etc.).
 * Esto previene fugas de memoria al centralizar el almacenamiento de blobs y permitir
 * que los componentes creen y revoquen URLs de objetos de corta duración según sea necesario.
 */
class ImageBlobCache {
    private cache = new Map<string, Blob>();

    /**
     * Añade o actualiza un blob en el caché.
     * @param id El ID único para el activo.
     * @param blob El objeto Blob a almacenar.
     */
    set(id: string, blob: Blob) {
        this.cache.set(id, blob);
    }

    /**
     * Recupera un blob del caché.
     * @param id El ID del activo a recuperar.
     * @returns El objeto Blob o undefined si no se encuentra.
     */
    get(id: string): Blob | undefined {
        return this.cache.get(id);
    }

    /**
     * Elimina un blob del caché.
     * @param id El ID del activo a eliminar.
     */
    remove(id: string) {
        this.cache.delete(id);
    }

    /**
     * Comprueba si un activo existe en el caché.
     * @param id El ID del activo a comprobar.
     * @returns true si el activo está en el caché, de lo contrario false.
     */
    has(id: string): boolean {
        return this.cache.has(id);
    }
    
    /**
     * Limpia todo el caché. Esencial para llamar cuando se sale de una sesión
     * de edición para liberar toda la memoria.
     */
    clear() {
        this.cache.clear();
    }
}

export const imageBlobCache = new ImageBlobCache();
