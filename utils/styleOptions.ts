/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// This file centralizes all style options for Phase 2, providing a single
// source of truth for both the UI and the AI suggestion prompts.

export const STYLE_OPTIONS_COMPLETE = {
  outputFormat: {
    "Video (Redes Sociales)": [
      "TikTok / Reels (Vertical)",
      "Video Cuadrado (Feed)",
      "Video para Twitter/X",
      "Anuncio Publicitario (15s)",
      "Anuncio Publicitario (30s)",
      "Historia de Instagram/FB"
    ],
    "Video (Cinematográfico y Largo)": [
      "Cortometraje (1-5 min)",
      "Tráiler Cinematográfico",
      "Video Musical",
      "Video Único (hasta 60s)",
      "Serie de Videos (Episódica)",
      "Documental Corto"
    ],
    "Contenido Estático": [
      "Carrusel Estático (Instagram)",
      "Tira Cómica",
      "Storyboard Profesional",
      "Infografía Narrativa",
      "Serie de Pósters",
      "Lookbook de Moda",
      "Fotografía de Producto"
    ],
    "Contenido Interactivo": [
      "Historia Interactiva (Twine)",
      "Elige tu Aventura (Video)",
      "Historia-Quiz",
      "Historia por Encuestas",
      "Filtro AR de Instagram/Snapchat",
      "Juego de Realidad Alternativa (ARG)"
    ],
    "Formatos de Audio": [
      "Podcast de Ficción",
      "Audio-Drama",
      "Anuncio de Audio (Spotify)",
      "Meditación Guiada Narrativa",
      "Podcast Visual"
    ],
    "Formatos Híbridos y Experimentales": [
      "Slideshow Animado",
      "Secuencia de GIFs",
      "Narrativa con Memes",
      "Historia de Capturas",
      "Scroll Infinito Vertical (Webtoon)",
      "Historia en Realidad Aumentada",
      "Simulación de \"En Vivo\"",
      "Experiencia Web Interactiva",
      "Correo Electrónico Narrativo"
    ]
  },
  narrativeStyle: {
    "Géneros Clásicos": [
      "Comedia", "Drama", "Misterio", "Suspense (Thriller)", "Terror", "Aventura", "Ciencia Ficción", "Fantasía", "Romance", "Acción"
    ],
    "Subgéneros y Mezclas": [
      "Comedia Negra", "Tragicomedia", "Thriller Psicológico", "Terror Cósmico (Lovecraft)", "Cyberpunk", "Steampunk", "Fantasía Urbana", "Realismo Mágico", "Film Noir", "Neo-Western"
    ],
    "Tonos y Moods": [
      "Nostálgico", "Melancólico", "Inspirador / Motivacional", "Satírico", "Absurdo", "Contemplativo", "Enérgico / Frenético", "Onírico (de ensueño)", "Siniestro / Inquietante"
    ],
    "Estilos Narrativos y Experimentales": [
      "Documental", "Falso Documental (Mockumentary)", "Surrealista", "Minimalista", "Meta-narrativo", "No Lineal", "Poético", "Slice of Life (Fragmento de vida)"
    ]
  },
  visualStyle: {
    "Cinematográfico": [
      "Hiperrealista", "Look \"Film Noir\"", "Teal & Orange", "Cinematográfico Desaturado", "Hora Dorada", "Look \"Bleach Bypass\"", "Cámara en Mano (Found Footage)", "Look \"Wes Anderson\""
    ],
    "Animación": [
      "Estilo Ghibli", "Anime de los 90", "Anime Moderno", "Estilo Pixar (3D)", "Estilo \"Spider-Verse\"", "Stop Motion", "Cartoon Clásico Americano", "Estilo \"Tim Burton\""
    ],
    "Artístico / Pictórico": [
      "Pintura al Óleo", "Acuarela", "Dibujo a Carboncillo", "Arte Pop (Warhol)", "Impresionismo", "Cubismo", "Surrealismo (Dalí)"
    ],
    "Retro / Vintage": [
      "Vintage Polaroid '70s", "Technicolor de los 50", "Look VHS de los 80", "Tono Sepia", "Daguerrotipo"
    ],
    "Blanco y Negro": [
      "Alto Contraste", "Grano Fino", "Infrarrojo (Falso)", "Tono Platino"
    ],
    "Moderno / Urbano": [
      "Cyberpunk Neón", "Grunge Urbano", "Minimalista", "Glitch Art", "Vaporwave"
    ]
  },
  narrativeStructure: {
      "Estructuras Fundamentales": [
        "Viaje del Héroe", "Estructura de Tres Actos", "Montaña de Freytag", "Estructura No Lineal", "In Media Res", "Estructura Episódica", "Pétalos de una Flor", "Falso Documental", "Estructura en Bucle (Loop)", "Narrativa Inversa"
      ]
  },
  hook: {
    "Ganchos de Curiosidad": [
      "Pregunta Inesperada", "Declaración Audaz o Polémica", "Imagen Misteriosa", "Sonido Intrigante", "Inicio \"In Media Res\"", "Fragmento del Final", "Promesa de un Secreto"
    ],
    "Ganchos Emocionales": [
      "Momento Relatable", "Empatía Inmediata", "Nostalgia", "Humor Absurdo", "Mascota Adorable", "Reacción Humana Genuina"
    ],
    "Ganchos Sensoriales y Disruptivos": [
      "Satisfacción Visual (ASMR Visual)", "Patrón Roto", "Movimiento Rápido Inesperado", "Falso Comienzo", "Silencio Súbito", "Error o \"Glitch\" Falso"
    ]
  },
  conflict: {
    "Conflicto Interno (Personaje vs. Sí Mismo)": [
      "Crisis de Identidad", "Dilema Moral", "Superar un Trauma Pasado", "Lucha contra una Adicción o Mal Hábito", "Aceptar una Verdad Difícil"
    ],
    "Conflicto Interpersonal (Personaje vs. Personaje)": [
      "Rivales por un Objetivo", "Conflicto Ideológico", "Traición", "Lucha de Poder", "Malentendido o Falta de Comunicación"
    ],
    "Conflicto Social (Personaje vs. Sociedad)": [
      "Lucha contra la Injusticia", "Rebelión contra las Normas Sociales", "Discriminación y Prejuicio", "Supervivencia en un Mundo Distópico"
    ],
    "Conflicto Ambiental (Personaje vs. Entorno)": [
      "Supervivencia en la Naturaleza", "Desastre Natural", "Entorno Hostil o Monstruo", "Aventura de Exploración"
    ]
  },
  ending: {
    "Finales Clásicos": [
      "Final Feliz", "Final Trágico", "Final Agridulce"
    ],
    "Finales Abiertos y Ambiguos": [
      "Final Abierto", "Final Ambiguo", "Cliffhanger"
    ],
    "Finales Sorpresa (Twists)": [
      "Giro de Trama (Plot Twist)", "El Narrador no es Fiable", "Todo fue un Sueño/Simulación", "Identidad Secreta Revelada"
    ],
    "Meta-Finales y No Convencionales": [
      "Rompimiento de la Cuarta Pared", "Final en Bucle (Loop)", "Sin Resolución (Anti-clímax)"
    ]
  }
};
