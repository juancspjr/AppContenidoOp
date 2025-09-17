/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export const outputFormats = {
    "Video (Redes Sociales)": [
        { name: 'TikTok / Reels (Vertical)', value: 'tiktok_vertical', description: 'Formato 9:16 optimizado para TikTok, Instagram Reels, y YouTube Shorts. Rápido, dinámico y con potencial viral.' },
        { name: 'Video Cuadrado (Feed)', value: 'square_video', description: 'Formato 1:1 ideal para feeds de Instagram y Facebook. Buena visibilidad en móviles.' },
        { name: 'Video para Twitter/X', value: 'twitter_video', description: 'Video horizontal corto (hasta 2:20 min), optimizado para el feed de Twitter/X.' },
        { name: 'Anuncio Publicitario (15s)', value: 'video_ad_15s', description: 'Video de 15s con estructura de anuncio (problema-solución-CTA). Ideal para Bumper Ads.' },
        { name: 'Anuncio Publicitario (30s)', value: 'video_ad_30s', description: 'Video de 30s con una narrativa más desarrollada. Ideal para anuncios In-Stream.' },
        { name: 'Historia de Instagram/FB', value: 'story_video', description: 'Serie de clips de 15s en formato 9:16 diseñados para ser vistos como una historia continua.' },
    ],
    "Video (Cinematográfico y Largo)": [
        { name: 'Cortometraje (1-5 min)', value: 'short_film', description: 'Una narrativa completa con desarrollo de personajes y trama en formato cinematográfico.' },
        { name: 'Tráiler Cinematográfico', value: 'movie_trailer', description: 'Un tráiler de 1-2 minutos que resume una historia más grande de forma emocionante.' },
        { name: 'Video Musical', value: 'music_video', description: 'Una pieza visual que acompaña y reinterpreta una canción.' },
        { name: 'Video Único (hasta 60s)', value: 'single_video', description: 'Un video completo de hasta 60 segundos con una narrativa autocontenida.' },
        { name: 'Serie de Videos (Episódica)', value: 'video_series', description: 'Historia episódica en varios videos cortos, optimizada para retención.' },
        { name: 'Documental Corto', value: 'short_documentary', description: 'Una pieza corta que explora un tema real de forma informativa y atractiva.' },
    ],
    "Contenido Estático": [
        { name: 'Carrusel Estático (Instagram)', value: 'carousel_static', description: '6-10 imágenes estáticas con progresión narrativa. Ideal para tutoriales o historias visuales en Instagram.' },
        { name: 'Tira Cómica', value: 'comic_strip', description: 'Formato cómic con viñetas y diálogos. Para historias visuales directas y humorísticas.' },
        { name: 'Storyboard Profesional', value: 'storyboard_professional', description: 'Storyboard cinematográfico con anotaciones técnicas para pre-producción.' },
        { name: 'Infografía Narrativa', value: 'infographic_story', description: 'Historia contada a través de una infografía visual. Para explicar procesos o datos complejos.' },
        { name: 'Serie de Pósters', value: 'poster_series', description: 'Serie de pósters conectados narrativamente. Ideal para campañas de marketing o eventos.' },
        { name: 'Lookbook de Moda', value: 'fashion_lookbook', description: 'Una colección de imágenes de alta calidad que muestran una línea de ropa o estilo.' },
        { name: 'Fotografía de Producto', value: 'product_photography', description: 'Imágenes estilizadas de productos para comercio electrónico o publicidad.' },
    ],
    "Contenido Interactivo": [
        { name: 'Historia Interactiva (Twine)', value: 'interactive_story', description: 'Historia basada en texto con puntos de decisión donde el usuario elige el camino.' },
        { name: 'Elige tu Aventura (Video)', value: 'choose_adventure_video', description: 'Narrativa de video ramificada con múltiples finales posibles según las elecciones del usuario (estilo Bandersnatch).' },
        { name: 'Historia-Quiz', value: 'quiz_story', description: 'Historia que integra preguntas y respuestas para avanzar o revelar un resultado personalizado.' },
        { name: 'Historia por Encuestas', value: 'poll_driven', description: 'La historia evoluciona según los resultados de encuestas para la audiencia en redes sociales.' },
        { name: 'Filtro AR de Instagram/Snapchat', value: 'ar_filter_story', description: 'Una narrativa o experiencia contada a través de un filtro de Realidad Aumentada.' },
        { name: 'Juego de Realidad Alternativa (ARG)', value: 'arg_elements', description: 'Pistas y elementos narrativos distribuidos en múltiples plataformas online y offline.' },
    ],
    "Formatos de Audio": [
        { name: 'Podcast de Ficción', value: 'fiction_podcast', description: 'Una historia completa contada a través de diálogo, narración y diseño de sonido.' },
        { name: 'Audio-Drama', value: 'audio_drama', description: 'Similar a un podcast de ficción, pero más centrado en la actuación y el sonido inmersivo.' },
        { name: 'Anuncio de Audio (Spotify)', value: 'audio_ad', description: 'Un anuncio de audio de 30 segundos para plataformas como Spotify o podcasts.' },
        { name: 'Meditación Guiada Narrativa', value: 'narrative_meditation', description: 'Una meditación que guía al oyente a través de una historia relajante.' },
        { name: 'Podcast Visual', value: 'podcast_visual', description: 'Un podcast o narrativa de audio acompañada de elementos visuales sincronizados (imágenes, gráficos).' },
    ],
    "Formatos Híbridos y Experimentales": [
        { name: 'Slideshow Animado', value: 'slideshow_animated', description: 'Diapositivas con micro-animaciones y transiciones elegantes. Un "video" hecho de imágenes fijas.' },
        { name: 'Secuencia de GIFs', value: 'gif_story_sequence', description: 'Una serie de GIFs que, vistos en orden, cuentan una historia completa.' },
        { name: 'Narrativa con Memes', value: 'meme_narrative', description: 'Historia contada a través de una secuencia conectada de memes.' },
        { name: 'Historia de Capturas', value: 'screenshot_story', description: 'Narrativa contada a través de capturas de pantalla de chats, redes sociales o interfaces.' },
        { name: 'Scroll Infinito Vertical (Webtoon)', value: 'vertical_scroll_infinite', description: 'Una historia que se revela a medida que el usuario hace scroll vertical (estilo Webtoon o Manhwa).' },
        { name: 'Historia en Realidad Aumentada', value: 'augmented_reality_story', description: 'Historia con elementos de Realidad Aumentada superpuestos en el mundo real a través de un dispositivo.' },
        { name: 'Simulación de "En Vivo"', value: 'live_story_simulation', description: 'Simula una transmisión en vivo, como en Instagram Live o Twitch, con comentarios y eventos en tiempo real.' },
        { name: 'Experiencia Web Interactiva', value: 'interactive_website', description: 'Una página web que cuenta una historia a medida que el usuario interactúa con ella.' },
        { name: 'Correo Electrónico Narrativo', value: 'email_narrative', description: 'Una historia contada a través de una secuencia de correos electrónicos enviados al usuario.' },
    ]
};

export const narrativeStyles = {
    "Géneros Clásicos": [
        { name: 'Comedia', description: 'Busca hacer reír, con situaciones humorísticas y diálogos ingeniosos.' },
        { name: 'Drama', description: 'Se centra en conflictos emocionales serios y el desarrollo de personajes.' },
        { name: 'Misterio', description: 'Plantea un enigma o crimen que debe ser resuelto.' },
        { name: 'Suspense (Thriller)', description: 'Genera tensión y anticipación en la audiencia sobre lo que va a ocurrir.' },
        { name: 'Terror', description: 'Busca provocar miedo, horror y suspense.' },
        { name: 'Aventura', description: 'Presenta un viaje arriesgado con acción y exploración.' },
        { name: 'Ciencia Ficción', description: 'Explora conceptos basados en la ciencia y la tecnología, a menudo en el futuro.' },
        { name: 'Fantasía', description: 'Incluye elementos mágicos y sobrenaturales en un mundo imaginario.' },
        { name: 'Romance', description: 'Se centra en la relación amorosa entre los personajes.' },
        { name: 'Acción', description: 'Predominan las secuencias de lucha, persecuciones y proezas físicas.' },
    ],
    "Subgéneros y Mezclas": [
        { name: 'Comedia Negra', description: 'Humor que trata temas serios o tabú como la muerte o el crimen.' },
        { name: 'Tragicomedia', description: 'Mezcla elementos de la tragedia y la comedia.' },
        { name: 'Thriller Psicológico', description: 'El suspense se centra en la inestabilidad mental y emocional de los personajes.' },
        { name: 'Terror Cósmico (Lovecraft)', description: 'Miedo a lo desconocido, a entidades incomprensibles y a la insignificancia humana.' },
        { name: 'Cyberpunk', description: 'Ciencia ficción distópica con alta tecnología y bajo nivel de vida.' },
        { name: 'Steampunk', description: 'Ciencia ficción ambientada en una era victoriana con tecnología de vapor avanzada.' },
        { name: 'Fantasía Urbana', description: 'Elementos fantásticos que irrumpen en un entorno urbano y moderno.' },
        { name: 'Realismo Mágico', description: 'Eventos mágicos o maravillosos se presentan como normales en un entorno realista.' },
        { name: 'Film Noir', description: 'Cine negro, con un tono cínico, crimen, y una estética oscura y estilizada.' },
        { name: 'Neo-Western', description: 'Temas del western clásico en un escenario contemporáneo.' },
    ],
    "Tonos y Moods": [
        { name: 'Nostálgico', description: 'Evoca una sensación de anhelo por el pasado.' },
        { name: 'Melancólico', description: 'Un tono triste, pensativo y soñador.' },
        { name: 'Inspirador / Motivacional', description: 'Busca elevar el ánimo y motivar a la acción.' },
        { name: 'Satírico', description: 'Critica la sociedad, las personas o las ideas a través del humor y la exageración.' },
        { name: 'Absurdo', description: 'Las situaciones y los diálogos desafían la lógica y la razón.' },
        { name: 'Contemplativo', description: 'Un tono lento, reflexivo y filosófico.' },
        { name: 'Enérgico / Frenético', description: 'Un ritmo rápido, con mucha acción y estímulos.' },
        { name: 'Onírico (de ensueño)', description: 'La lógica de la historia sigue la de los sueños, con imágenes y transiciones surrealistas.' },
        { name: 'Siniestro / Inquietante', description: 'Genera una sensación de malestar y extrañeza, sin llegar al terror explícito.' },
    ],
    "Estilos Narrativos y Experimentales": [
        { name: 'Documental', description: 'Basado en hechos reales, con un enfoque informativo.' },
        { name: 'Falso Documental (Mockumentary)', description: 'Ficción que imita el estilo de un documental para crear humor o drama.' },
        { name: 'Surrealista', description: 'Rompe con la lógica y la realidad, explorando el subconsciente.' },
        { name: 'Minimalista', description: 'Utiliza los mínimos elementos necesarios para contar la historia.' },
        { name: 'Meta-narrativo', description: 'La historia es consciente de sí misma como una historia.' },
        { name: 'No Lineal', description: 'La trama no sigue un orden cronológico.' },
        { name: 'Poético', description: 'El lenguaje y las imágenes tienen un enfoque más lírico y evocador que narrativo.' },
        { name: 'Slice of Life (Fragmento de vida)', description: 'Se centra en momentos cotidianos y aparentemente mundanos.' },
    ]
};

export const visualStyles = {
    "Cinematográfico": [
        { name: 'Hiperrealista', description: 'Calidad de imagen indistinguible de una fotografía de alta gama.' },
        { name: 'Look "Film Noir"', description: 'Blanco y negro de alto contraste, sombras dramáticas y una atmósfera de misterio.' },
        { name: 'Teal & Orange', description: 'Paleta de colores de Hollywood con tonos de piel naranjas y sombras azuladas.' },
        { name: 'Cinematográfico Desaturado', description: 'Colores apagados y un tono melancólico para un efecto dramático.' },
        { name: 'Hora Dorada', description: 'Luz cálida, suave y dorada que simula el amanecer o el atardecer.' },
        { name: 'Look "Bleach Bypass"', description: 'Aspecto crudo, desaturado y de alto contraste, común en películas de acción.' },
        { name: 'Cámara en Mano (Found Footage)', description: 'Estilo realista y tembloroso que simula ser grabado por un personaje.' },
        { name: 'Look "Wes Anderson"', description: 'Composiciones simétricas, paletas de colores pastel y un aspecto peculiar.' },
    ],
    "Animación": [
        { name: 'Estilo Ghibli', description: 'Estilo pictórico y detallado inspirado en Studio Ghibli, con un toque de magia.' },
        { name: 'Anime de los 90', description: 'Estética de anime con grano de película, colores mate y un estilo de dibujo clásico.' },
        { name: 'Anime Moderno', description: 'Colores vibrantes, iluminación dinámica y fondos detallados.' },
        { name: 'Estilo Pixar (3D)', description: 'Animación 3D pulida con superficies suaves, texturas realistas e iluminación avanzada.' },
        { name: 'Estilo "Spider-Verse"', description: 'Mezcla de 3D, 2D, tramas de cómic y aberración cromática para un look innovador.' },
        { name: 'Stop Motion', description: 'Apariencia táctil y artesanal que simula la animación fotograma a fotograma.' },
        { name: 'Cartoon Clásico Americano', description: 'Líneas audaces, colores brillantes y física exagerada.' },
        { name: 'Estilo "Tim Burton"', description: 'Estética gótica y alargada con una paleta de colores oscura y caprichosa.' },
    ],
    "Artístico / Pictórico": [
        { name: 'Pintura al Óleo', description: 'Textura y pinceladas de una pintura al óleo clásica.' },
        { name: 'Acuarela', description: 'Colores translúcidos y bordes suaves que simulan una pintura de acuarela.' },
        { name: 'Dibujo a Carboncillo', description: 'Blanco y negro con textura de carboncillo, desde trazos finos hasta manchas gruesas.' },
        { name: 'Arte Pop (Warhol)', description: 'Colores brillantes, alto contraste y una estética de serigrafía.' },
        { name: 'Impresionismo', description: 'Pinceladas visibles y un enfoque en la luz y el movimiento.' },
        { name: 'Cubismo', description: 'Formas geométricas y múltiples puntos de vista simultáneos.' },
        { name: 'Surrealismo (Dalí)', description: 'Imágenes oníricas, extrañas y subconscientes.' },
    ],
    "Retro / Vintage": [
        { name: 'Vintage Polaroid \'70s', description: 'Colores desvaídos, un tinte amarillento y el clásico marco de Polaroid.' },
        { name: 'Technicolor de los 50', description: 'Colores hipersaturados y vibrantes, como en las películas clásicas de Hollywood.' },
        { name: 'Look VHS de los 80', description: 'Baja resolución, artefactos de video y líneas de escaneo.' },
        { name: 'Tono Sepia', description: 'Un tinte marrón que da un aspecto de fotografía antigua.' },
        { name: 'Daguerrotipo', description: 'Aspecto de las primeras fotografías, con un tono metálico y alto detalle.' },
    ],
    "Blanco y Negro": [
        { name: 'Alto Contraste', description: 'Negros profundos y blancos puros para un efecto dramático.' },
        { name: 'Grano Fino', description: 'Look clásico con una gama tonal completa y una textura de grano sutil.' },
        { name: 'Infrarrojo (Falso)', description: 'El follaje se vuelve blanco y los cielos oscuros, creando un paisaje de otro mundo.' },
        { name: 'Tono Platino', description: 'Un acabado sofisticado con una rica gama de grises fríos.' },
    ],
    "Moderno / Urbano": [
        { name: 'Cyberpunk Neón', description: 'Ambiente oscuro con luces de neón brillantes, reflejos y una estética futurista.' },
        { name: 'Grunge Urbano', description: 'Aspecto crudo, con texturas marcadas, colores desaturados y alto contraste.' },
        { name: 'Minimalista', description: 'Composiciones limpias, espacio negativo y una paleta de colores limitada.' },
        { name: 'Glitch Art', description: 'Errores digitales, distorsión de píxeles y colores corruptos.' },
        { name: 'Vaporwave', description: 'Estética retro-futurista con colores pastel de neón y motivos de los 80/90.' },
    ],
};

export const narrativeStructures = [
    { name: 'Viaje del Héroe', description: 'Estructura clásica de 12 pasos. Un héroe emprende una aventura, gana una victoria y regresa transformado.' },
    { name: 'Estructura de Tres Actos', description: 'Planteamiento, Nudo y Desenlace. La estructura de guion más común y efectiva.' },
    { name: 'Montaña de Freytag', description: 'Una estructura de 5 actos: exposición, acción ascendente, clímax, acción descendente y desenlace.' },
    { name: 'Estructura No Lineal', description: 'La historia se cuenta fuera de orden cronológico, usando flashbacks o flashforwards.' },
    { name: 'In Media Res', description: 'La historia comienza en medio de la acción, y el trasfondo se revela más tarde.' },
    { name: 'Estructura Episódica', description: 'Una serie de capítulos o historias vagamente conectadas, centradas en un personaje o mundo.' },
    { name: 'Pétalos de una Flor', description: 'Se exploran múltiples líneas argumentales que se conectan a un evento o personaje central.' },
    { name: 'Falso Documental', description: 'La historia se presenta como un documental real, a menudo con entrevistas y metraje "encontrado".' },
    { name: 'Estructura en Bucle (Loop)', description: 'El personaje repite un período de tiempo una y otra vez hasta que rompe el ciclo.' },
    { name: 'Narrativa Inversa', description: 'La historia se cuenta hacia atrás, desde el final hasta el principio.' },
];

export const hookTypes = {
    "Ganchos de Curiosidad": [
        { name: 'Pregunta Inesperada', description: 'Comenzar con una pregunta que la audiencia necesita responder.' },
        { name: 'Declaración Audaz o Polémica', description: 'Una afirmación fuerte que genera debate o sorpresa.' },
        { name: 'Imagen Misteriosa', description: 'Mostrar algo fuera de lugar o inexplicable.' },
        { name: 'Sonido Intrigante', description: 'Un sonido que no encaja con la imagen y crea misterio.' },
        { name: 'Inicio "In Media Res"', description: 'Empezar en medio de una acción intensa sin explicación.' },
        { name: 'Fragmento del Final', description: 'Mostrar un breve vistazo del clímax o el final de la historia.' },
        { name: 'Promesa de un Secreto', description: 'Texto o narración que promete revelar algo ("Lo que no sabías sobre...").' },
    ],
    "Ganchos Emocionales": [
        { name: 'Momento Relatable', description: 'Una situación cotidiana con la que la audiencia se identifica al instante.' },
        { name: 'Empatía Inmediata', description: 'Mostrar a un personaje en una situación de vulnerabilidad o alegría intensa.' },
        { name: 'Nostalgia', description: 'Usar música, imágenes o referencias a una época pasada popular.' },
        { name: 'Humor Absurdo', description: 'Algo tan inesperado y sin sentido que es gracioso.' },
        { name: 'Mascota Adorable', description: 'Un animal haciendo algo tierno o divertido.' },
        { name: 'Reacción Humana Genuina', description: 'Una risa contagiosa, un llanto real, una sorpresa auténtica.' },
    ],
    "Ganchos Sensoriales y Disruptivos": [
        { name: 'Satisfacción Visual (ASMR Visual)', description: 'Cortes perfectos, texturas satisfactorias, movimientos fluidos.' },
        { name: 'Patrón Roto', description: 'Mostrar una secuencia y luego romperla bruscamente.' },
        { name: 'Movimiento Rápido Inesperado', description: 'Un corte o movimiento de cámara muy rápido que capta la atención.' },
        { name: 'Falso Comienzo', description: 'Hacer creer que la historia va a ser sobre una cosa, y luego cambiarla por completo.' },
        { name: 'Silencio Súbito', description: 'Cortar todo el sonido en un momento clave.' },
        { name: 'Error o "Glitch" Falso', description: 'Simular un error de video para que la gente se detenga a mirar.' },
    ]
};

export const conflictTypes = {
    "Conflicto Interno (Personaje vs. Sí Mismo)": [
        { name: 'Crisis de Identidad', description: 'El personaje lucha por saber quién es o cuál es su propósito.' },
        { name: 'Dilema Moral', description: 'El personaje debe tomar una decisión difícil entre dos opciones moralmente ambiguas.' },
        { name: 'Superar un Trauma Pasado', description: 'El personaje está paralizado por un evento traumático de su pasado.' },
        { name: 'Lucha contra una Adicción o Mal Hábito', description: 'Una batalla interna contra un comportamiento destructivo.' },
        { name: 'Aceptar una Verdad Difícil', description: 'El personaje se niega a aceptar una realidad dolorosa sobre sí mismo o el mundo.' },
    ],
    "Conflicto Interpersonal (Personaje vs. Personaje)": [
        { name: 'Rivales por un Objetivo', description: 'Dos o más personajes compiten por el mismo objetivo.' },
        { name: 'Conflicto Ideológico', description: 'Los personajes tienen valores o creencias fundamentalmente opuestos.' },
        { name: 'Traición', description: 'Un personaje es traicionado por alguien en quien confiaba.' },
        { name: 'Lucha de Poder', description: 'Una batalla por el control o la dominación sobre otro personaje.' },
        { name: 'Malentendido o Falta de Comunicación', description: 'El conflicto principal surge de una comunicación fallida.' },
    ],
    "Conflicto Social (Personaje vs. Sociedad)": [
        { name: 'Lucha contra la Injusticia', description: 'El personaje se enfrenta a un sistema o gobierno corrupto.' },
        { name: 'Rebelión contra las Normas Sociales', description: 'El personaje desafía las expectativas o tradiciones de su comunidad.' },
        { name: 'Discriminación y Prejuicio', description: 'El personaje es marginado o atacado por su identidad.' },
        { name: 'Supervivencia en un Mundo Distópico', description: 'El personaje lucha por sobrevivir bajo un régimen totalitario.' },
    ],
    "Conflicto Ambiental (Personaje vs. Entorno)": [
        { name: 'Supervivencia en la Naturaleza', description: 'El personaje está perdido o atrapado en un entorno salvaje.' },
        { name: 'Desastre Natural', description: 'El personaje debe sobrevivir a un evento como un terremoto, tsunami o huracán.' },
        { name: 'Entorno Hostil o Monstruo', description: 'El personaje es cazado o acechado por una criatura o un entorno peligroso.' },
        { name: 'Aventura de Exploración', description: 'El conflicto es el desafío de explorar un lugar desconocido y peligroso.' },
    ]
};

export const endingTypes = {
    "Finales Clásicos": [
        { name: 'Final Feliz', description: 'El protagonista logra su objetivo y el conflicto se resuelve positivamente.' },
        { name: 'Final Trágico', description: 'El protagonista fracasa o muere, dejando una sensación de pérdida.' },
        { name: 'Final Agridulce', description: 'El protagonista logra su objetivo, pero a un gran costo personal.' },
    ],
    "Finales Abiertos y Ambiguos": [
        { name: 'Final Abierto', description: 'El conflicto principal se resuelve, pero el futuro de los personajes queda incierto.' },
        { name: 'Final Ambiguo', description: 'No queda claro qué sucedió realmente, dejando la interpretación al espectador.' },
        { name: 'Cliffhanger', description: 'La historia termina en un momento de máximo suspense, sin resolver el conflicto inmediato.' },
    ],
    "Finales Sorpresa (Twists)": [
        { name: 'Giro de Trama (Plot Twist)', description: 'Se revela información que cambia por completo la comprensión de la historia.' },
        { name: 'El Narrador no es Fiable', description: 'Se revela que la persona que cuenta la historia ha estado mintiendo o equivocada.' },
        { name: 'Todo fue un Sueño/Simulación', description: 'Los eventos de la historia no ocurrieron en la realidad.' },
        { name: 'Identidad Secreta Revelada', description: 'Se revela la verdadera identidad de un personaje, cambiando todas las dinámicas.' },
    ],
    "Meta-Finales y No Convencionales": [
        { name: 'Rompimiento de la Cuarta Pared', description: 'Un personaje se dirige directamente a la audiencia al final.' },
        { name: 'Final en Bucle (Loop)', description: 'El final de la historia conecta con el principio, creando un ciclo sin fin.' },
        { name: 'Sin Resolución (Anti-clímax)', description: 'El conflicto esperado nunca se resuelve, de forma intencionada.' },
    ]
};

export const COST_OPTIMIZATION_CONFIG = {
    maxCharactersPerProject: 3, // Limitar para controlar costos
    maxScenesForFrameGeneration: 5, // Limitar escenas con frames
    throttleDelay: 12000, // 12s entre imágenes para respetar límites
    batchSize: 10, // Procesar en lotes de 10 imágenes max
    fallbackStrategy: 'gemini-2.5-flash-image', // Modelo más barato primero
    
    // Alertas de costo
    costAlerts: {
        warningThreshold: 0.50, // Advertir cuando supere $0.50
        maxBudget: 1.00, // Límite máximo por proyecto
        dailyBudget: 2.00 // Límite diario
    }
};