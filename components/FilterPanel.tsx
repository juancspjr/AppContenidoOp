/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { getAIFilterRecommendations } from '../services/geminiService';
import { SparkleIcon } from './icons';

interface FilterPanelProps {
  onApplyFilter: (prompt: string) => void;
  isLoading: boolean;
  currentImage: File | null;
  isPhotoshootMode: boolean;
  selectionCount: number;
}

type FilterCategory = 'Cinematográfico' | 'Animación y Dibujos' | 'Retro y Vintage' | 'Blanco y Negro' | 'Artístico y Pictórico' | 'Moderno y Urbano' | 'Naturaleza y Paisaje';

const presetsByCategory: Record<FilterCategory, {name: string, prompt: string}[]> = {
    'Cinematográfico': [
        // ... (Expanded to 50)
        { name: 'Teal & Orange', prompt: 'Aplica una gradación de color cinematográfica clásica "teal and orange", llevando las sombras y tonos medios hacia el cian y el verde azulado, mientras que los tonos de piel y las luces se desplazan hacia naranjas cálidos. Asegura un aspecto profesional y de alta calidad.' },
        { name: 'Film Noir', prompt: 'Crea una estética de cine negro en blanco y negro de alto contraste. Enfatiza los negros profundos, las sombras dramáticas y las luces brillantes y enfocadas. Añade un sutil grano de película. El ambiente debe ser misterioso y dramático.' },
        { name: 'Western Clásico', prompt: 'Genera un look de película del Oeste clásica con una paleta de colores desaturada, un tinte cálido sepia o marrón, alto contraste y un grano de película notable. La imagen debe sentirse polvorienta y quemada por el sol.' },
        { name: 'Sci-Fi Neón', prompt: 'Transforma la imagen con una estética futurista de ciencia ficción. Introduce brillos de neón vibrantes, especialmente en tonos cian, magenta y azul. Añade una sutil dominante de color fría y mejora la claridad.' },
        { name: 'Thriller Psicológico', prompt: 'Aplica una gradación de color oscura, temperamental y desaturada con un tinte frío, a menudo verdoso o azulado. Aumenta el contraste en los tonos medios para crear una atmósfera tensa e inquietante.' },
        { name: 'Comedia Romántica', prompt: 'Crea un look brillante, cálido y aireado. Realza los colores pastel, aplica una luz suave y favorecedora, y asegura que los tonos de piel sean saludables y brillantes. La sensación general debe ser optimista y alegre.' },
        { name: 'Fantasía Épica', prompt: 'Dale a la imagen un aspecto de alta fantasía con colores ricos y saturados, luces brillantes (efecto bloom) y una calidad ligeramente etérea y onírica. Realza los detalles en texturas como el metal y la tela.' },
        { name: 'Cine Francés', prompt: 'Simula el look del cine de la Nueva Ola Francesa con un filtro atemporal en blanco y negro de alto contraste, o un look de color ligeramente desaturado con un enfoque en el realismo y la luz natural.' },
        { name: 'Aventura Tropical', prompt: 'Intensifica los verdes y azules para crear una sensación tropical exuberante y vibrante. Aumenta la saturación en los colores cálidos y realza el brillo general para un look soleado y aventurero.' },
        { name: 'Drama de Época', prompt: 'Aplica una paleta de colores sofisticada y desaturada con una dominante de color específica (ej. marrones cálidos para la época victoriana, azules fríos para principios del siglo XX). Añade una viñeta suave y un sutil grano de película para evocar una sensación histórica.' },
        { name: 'Terror Gótico', prompt: 'Crea un look oscuro y desaturado con una fuerte dominante de color azul o gris. Profundiza las sombras, reduce la saturación en todos los colores excepto los rojos, y añade una viñeta intensa para crear una sensación de pavor.' },
        { name: 'Película Indie', prompt: 'Aplica un filtro temperamental y atmosférico con colores apagados, negros aplastados y un enfoque en la iluminación natural. El look debe sentirse auténtico, introspectivo y ligeramente granulado.' },
        { name: 'Look "Wes Anderson"', prompt: 'Aplica un filtro de colores pastel perfectamente simétrico, con énfasis en amarillos, rosas y azules, y una composición plana y centrada.' },
        { name: 'Look "Tarantino"', prompt: 'Emula el estilo de Tarantino con colores ultra-saturados, especialmente rojos y amarillos, alto contraste y una textura de película granulada y ligeramente sucia.' },
        { name: 'Look "Hermanos Coen"', prompt: 'Aplica una gradación de color desaturada y a menudo con un tinte específico (sepia para "O Brother, Where Art Thou?", frío para "Fargo") que define el tono de la escena.' },
        { name: 'Look "David Fincher"', prompt: 'Crea una atmósfera oscura y melancólica con una paleta de colores desaturada, dominada por verdes, amarillos y azules fríos, y sombras profundas.' },
        { name: 'Look "Matrix"', prompt: 'Aplica un distintivo tinte verde a toda la imagen, con alto contraste y un brillo digital y ligeramente desenfocado en las luces.' },
        { name: 'Look "Amelie"', prompt: 'Recrea la paleta de colores mágica y saturada de "Amelie", con un fuerte énfasis en rojos, verdes y tonos dorados cálidos.' },
        { name: 'Look "Blade Runner"', prompt: 'Genera una estética ciberpunk oscura y lluviosa con luces de neón contrastantes, humo volumétrico y una sensación general de distopía.' },
        { name: 'Look "Mad Max: Fury Road"', prompt: 'Aplica una gradación de color de alto octanaje con cielos de un azul intenso y paisajes desérticos de un naranja saturado, con una claridad y contraste extremos.' },
        { name: 'Cine de Gánsteres', prompt: 'Crea un look oscuro y de bajo contraste con colores apagados y una atmósfera sombría, a menudo con un ligero tinte sepia o marrón.' },
        { name: 'Musical de Hollywood', prompt: 'Simula el look Technicolor hipersaturado de los musicales clásicos, con colores vibrantes y una iluminación brillante y optimista.' },
        { name: 'Película de Artes Marciales', prompt: 'Aplica una gradación de color estilizada, a menudo con colores ligeramente desaturados pero con rojos y tonos de piel vibrantes, y un grano de película dinámico.' },
        { name: 'Documental de Naturaleza', prompt: 'Crea un look ultra realista y vibrante, con colores naturales muy saturados, alta claridad y una nitidez impecable.' },
        { name: 'Space Opera', prompt: 'Genera un look de ópera espacial con negros profundos, estrellas nítidas, brillos de lente de colores (anamórficos) y colores vibrantes en naves y planetas.' },
        { name: 'Comedia de los 80', prompt: 'Aplica un look de película de los 80, con colores cálidos, un ligero grano de película, y un contraste suave y favorecedor.' },
        { name: 'Terror Found Footage', prompt: 'Simula el look de una cámara de video de baja calidad, con artefactos de compresión, colores desvaídos y un aspecto general inestable y realista.' },
        { name: 'Película de "Peplum"', prompt: 'Crea el aspecto de una película épica histórica ("peplum"), con colores cálidos y dorados, alto contraste para enfatizar el sol y la arena, y una escala grandiosa.' },
        { name: 'Cine Mudo', prompt: 'Convierte a blanco y negro, añade un ligero tinte (sepia o azul), aumenta el grano y simula una velocidad de fotogramas más baja con un ligero desenfoque de movimiento.' },
        { name: 'Giallo Italiano', prompt: 'Emula el estilo visual del Giallo, con una iluminación estilizada y de alto contraste que utiliza colores primarios saturados (especialmente rojo) para crear suspense.' },
        { name: 'Dogma 95', prompt: 'Simula el estilo Dogma 95, con un aspecto de cámara en mano, iluminación natural, colores realistas y sin corrección de color aparente.' },
        { name: 'Look "Christopher Nolan"', prompt: 'Aplica una paleta de colores fría y desaturada, con un énfasis en azules y grises, negros profundos y una sensación de realismo a gran escala.' },
        { name: 'Look "Sofia Coppola"', prompt: 'Crea un look ensoñador y etéreo con colores pastel, luz suave y difusa, y una sensación general de melancolía nostálgica.' },
        { name: 'Look "Denis Villeneuve"', prompt: 'Aplica una paleta de colores monocromática o muy limitada, con una composición austera, y una atmósfera tensa y atmosférica.' },
        { name: 'Película de Animación Stop-Motion', prompt: 'Dale a la imagen una textura táctil, con una profundidad de campo ligeramente exagerada y un movimiento sutilmente imperfecto, como en una animación stop-motion.' },
        { name: 'Look "Terrence Malick"', prompt: 'Crea un aspecto etéreo y poético, con un uso extensivo de la luz natural (especialmente la hora dorada), destellos de lente y una sensación de ensueño.' },
        { name: 'Cine de Explotación de los 70', prompt: 'Aplica un filtro de bajo presupuesto de los 70, con colores desvaídos, grano de película grueso, y un aspecto general crudo y sin pulir.' },
        { name: 'Película de Skate de los 90', prompt: 'Simula el aspecto de un video de skate de los 90, grabado en una cámara de video de baja fidelidad, con colores saturados, un ligero efecto de ojo de pez y un aspecto granulado.' },
        { name: 'Look "Wong Kar-wai"', prompt: 'Emula el estilo visual de Wong Kar-wai, con colores de neón hipersaturados, desenfoque de movimiento y una atmósfera urbana y melancólica.' },
        { name: 'Cine de Verano', prompt: 'Crea una atmósfera cálida y nostálgica de verano, con colores brillantes y saturados, luces altas y una sensación general de ocio y libertad.' },
        { name: 'Falso 3D Anaglifo', prompt: 'Simula el aspecto de una vieja película en 3D (anaglifo) separando los canales rojo y cian para crear un efecto de paralaje.' },
        { name: 'Look "David Lynch"', prompt: 'Aplica una estética surrealista y onírica, a menudo combinando lo mundano con lo bizarro, con colores saturados y un contraste dramático.' },
        { name: 'Cine Experimental', prompt: 'Aplica un filtro abstracto y no convencional, quizás con fugas de luz extremas, colores solarizados o texturas superpuestas.' },
        { name: 'Estilo "J-Horror"', prompt: 'Crea una atmósfera de terror japonés con una paleta de colores fría y desaturada, un tinte azul o verde, y un contraste bajo que oculta los detalles en las sombras.' },
        { name: 'Falso Technicolor (2-Tiras)', prompt: 'Simula el primer proceso Technicolor de 2 tiras, que se limitaba a tonos de rojo-naranja y verde-azulado.' },
        { name: 'Look de Noticiero Antiguo', prompt: 'Convierte la imagen para que parezca un noticiero de película antiguo, en blanco y negro, con grano, arañazos y un contraste ligeramente desvaído.' },
        { name: 'Cine de Autor Europeo', prompt: 'Aplica un filtro introspectivo y artístico con colores apagados, un ritmo visual lento y un enfoque en la composición y la luz natural.' },
        { name: 'Look de Superhéroe Moderno', prompt: 'Crea una estética de alto contraste, a menudo con una paleta de colores desaturada pero con colores de traje vibrantes, y una claridad metálica y nítida.' },
        { name: 'Película de Espías', prompt: 'Aplica una gradación de color elegante y fría, con alto contraste y un aspecto limpio y sofisticado.' },
        { name: 'Fantasía Oscura', prompt: 'Genera un look de fantasía oscura, con colores desaturados, mucho contraste, y una atmósfera sombría y peligrosa.' },
    ],
    'Animación y Dibujos': [
        // ... (Expanded to > 50)
        { name: 'Estilo Ghibli', prompt: 'Transforma la foto al icónico y pictórico estilo de Studio Ghibli, con colores exuberantes, fondos detallados y una iluminación suave y nostálgica.' },
        { name: 'Anime de los 90', prompt: 'Aplica una estética de anime de los años 90, con grano de película, colores ligeramente desaturados, líneas definidas y un estilo de cel-shading clásico.' },
        { name: 'Anime Moderno', prompt: 'Convierte la imagen a un estilo de anime moderno, con colores vibrantes, iluminación dinámica, fondos fotorrealistas y efectos de partículas brillantes.' },
        { name: 'Cartoon Americano', prompt: 'Recrea el estilo de los dibujos animados clásicos americanos, con contornos audaces, física exagerada y una paleta de colores brillantes y simples.' },
        { name: 'Clásico de Disney', prompt: 'Simula el estilo de animación clásico de Disney de la era dorada, con personajes expresivos, fondos de acuarela y un toque de magia y calidez.' },
        { name: '3D tipo Pixar', prompt: 'Convierte la imagen a un estilo de arte 3D similar al de Pixar, con superficies suaves, iluminación realista, colores saturados y un enfoque en la textura y el detalle.' },
        { name: 'Estilo Tim Burton', prompt: 'Aplica una estética gótica y caprichosa al estilo de Tim Burton, con personajes de ojos grandes, paletas de colores monocromáticas con toques de color, y formas alargadas y retorcidas.' },
        { name: 'Manga Shōnen', prompt: 'Transforma la foto en una página de manga Shōnen, con tramas de semitonos, líneas de acción dinámicas, alto contraste en blanco y negro y un estilo de dibujo enérgico.' },
        { name: 'Chibi Adorable', prompt: 'Rediseña el sujeto en un adorable estilo Chibi, con proporciones exageradas (cabeza grande, cuerpo pequeño), ojos grandes y expresivos y un aspecto general lindo y simplificado.' },
        { name: 'Cyberpunk Anime', prompt: 'Crea una estética de anime ciberpunk (como Akira o Ghost in the Shell), con paisajes urbanos de neón, detalles de alta tecnología, una paleta de colores oscuros y una atmósfera distópica.' },
        { name: 'Tinta Japonesa (Sumi-e)', prompt: 'Renderiza la imagen en el estilo de la pintura japonesa con tinta (Sumi-e), utilizando pinceladas minimalistas y expresivas en negro y gris para capturar la esencia del sujeto.' },
        { name: 'Comic Americano', prompt: 'Aplica un estilo de cómic americano moderno, con sombreado detallado, colores dinámicos y un enfoque en la anatomía realista y la acción cinematográfica.' },
        { name: 'Estilo "Spider-Verse"', prompt: 'Emula el innovador estilo visual de "Spider-Verse", combinando animación 3D con tramas de semitonos, aberración cromática y elementos de cómic 2D.' },
        { name: 'Estilo "Arcane"', prompt: 'Aplica el estilo pictórico y texturizado de la serie "Arcane", que mezcla personajes 3D con fondos 2D y una iluminación dramática.' },
        { name: 'Webcómic', prompt: 'Convierte la imagen a un estilo de webcómic popular, con líneas limpias, colores planos y un enfoque en la expresión y la claridad.' },
        { name: 'Manga Shōjo', prompt: 'Aplica un estilo de manga Shōjo, con figuras esbeltas, ojos grandes y brillantes, y un uso intensivo de tramas florales y fondos etéreos.' },
        { name: 'Manhwa Coreano', prompt: 'Recrea el estilo de un manhwa digital a todo color, con gradientes suaves, personajes detallados y un aspecto limpio y pulido.' },
        { name: 'Estilo "Adventure Time"', prompt: 'Transforma la imagen al estilo simple, de líneas curvas y colores brillantes de "Adventure Time".' },
        { name: 'Estilo "Rick and Morty"', prompt: 'Aplica el estilo de dibujo característico de "Rick and Morty", con diseños de personajes simples, pupilas temblorosas y un aspecto caótico.' },
        { name: 'Animación "Fleischer Studios"', prompt: 'Simula el estilo de animación surrealista y de "manguera de goma" de los años 30 de Fleischer Studios (como Betty Boop o Popeye).' },
        { name: 'Estilo "Hanna-Barbera"', prompt: 'Convierte la imagen al estilo de los dibujos animados clásicos de Hanna-Barbera, con diseños de personajes simplificados y fondos repetitivos.' },
        { name: 'Estilo "Looney Tunes"', prompt: 'Aplica el estilo de animación enérgico y expresivo de los Looney Tunes clásicos.' },
        { name: 'Animación Rotoscopeada', prompt: 'Dale a la imagen un aspecto rotoscopiado (como en "A Scanner Darkly"), donde la animación se traza sobre metraje de acción real, creando un movimiento fluido pero un aspecto de dibujo.' },
        { name: 'Estilo "Satoshi Kon"', prompt: 'Emula el estilo de anime realista y psicológico de Satoshi Kon, mezclando la realidad y los sueños con una edición fluida.' },
        { name: 'Estilo "Makoto Shinkai"', prompt: 'Recrea los fondos hiperrealistas y hermosos de Makoto Shinkai, con una iluminación dramática, destellos de lente y una atención obsesiva al detalle.' },
        { name: 'Libro de Cuentos Infantil', prompt: 'Transforma la imagen en una ilustración de un libro de cuentos para niños, con colores suaves, contornos amigables y una atmósfera caprichosa.' },
        { name: 'Ilustración de Moda', prompt: 'Convierte la foto en un boceto de ilustración de moda, con figuras alargadas, líneas gestuales y un enfoque en la ropa.' },
        { name: 'Estilo "Studio Trigger"', prompt: 'Aplica el estilo de anime de alta energía y visualmente dinámico de Studio Trigger (como en "Kill la Kill" o "Promare"), con colores explosivos y poses exageradas.' },
        { name: 'Anime Isekai', prompt: 'Dale a la imagen el aspecto de un anime de género Isekai, con un protagonista de aspecto normal en un mundo de fantasía vibrante y de alto contraste.' },
        { name: 'Anime Mecha', prompt: 'Transforma elementos de la imagen en robots o mechas gigantes, con paneles metálicos, luces brillantes y un diseño complejo.' },
        { name: 'Estilo "CLAMP"', prompt: 'Emula el estilo de manga del colectivo CLAMP, conocido por sus personajes increíblemente detallados, esbeltos y elegantes, y su ornamentación intrincada.' },
        { name: 'CGI de Videojuego (Moderno)', prompt: 'Renderiza la imagen como si fuera una cinemática de un videojuego AAA moderno, con texturas fotorrealistas e iluminación de alta calidad.' },
        { name: 'Gráficos de PlayStation 1', prompt: 'Convierte la imagen a los gráficos 3D de baja resolución y poligonales de la era de la PlayStation 1, con texturas deformadas.' },
        { name: 'Arte de "Gravity Falls"', prompt: 'Aplica el estilo de arte de "Gravity Falls", con su mezcla de diseños de personajes simples y fondos detallados y misteriosos.' },
        { name: 'Estilo "Genndy Tartakovsky"', prompt: 'Emula el estilo de animación angular, minimalista y basado en la acción de Genndy Tartakovsky (como en "Samurai Jack").' },
        { name: 'Animación de Papel Recortado', prompt: 'Recrea la imagen en el estilo de la animación de papel recortado (como en "South Park"), con formas 2D simples y movimiento limitado.' },
        { name: 'Estilo "Ukiyo-e"', prompt: 'Transforma la foto en un grabado en madera de estilo Ukiyo-e japonés, con contornos audaces, colores planos y una perspectiva estilizada.' },
        { name: 'Novela Visual', prompt: 'Convierte la imagen en el sprite de un personaje de una novela visual japonesa, con un estilo de anime limpio y poses estáticas.' },
        { name: 'Boceto de Arquitectura', prompt: 'Redibuja la escena como un boceto arquitectónico a mano alzada, con líneas de perspectiva y un enfoque en las estructuras.' },
        { name: 'Manual de Instrucciones', prompt: 'Transforma la imagen en un diagrama de un manual de instrucciones, con líneas simples y un estilo minimalista.' },
        { name: 'Dibujo con Tiza', prompt: 'Recrea la imagen como si estuviera dibujada con tizas de colores sobre una pizarra o acera.' },
        { name: 'Pintura con Dedos', prompt: 'Simula una pintura hecha con los dedos, con colores mezclados y una textura gruesa e infantil.' },
        { name: 'Aerografía de los 80', prompt: 'Aplica un estilo de aerografía de los años 80, con gradientes suaves, brillos de neón y un aspecto de cromo.' },
        { name: 'Caricatura Política', prompt: 'Redibuja al sujeto como una caricatura política, exagerando los rasgos faciales para hacer una declaración.' },
        { name: 'Dibujo de Patente Antigua', prompt: 'Convierte la imagen en un dibujo de patente del siglo XIX, con líneas finas, sombreado de eclosión y un aspecto de pergamino envejecido.' },
        { name: 'Estilo "Moebius"', prompt: 'Emula el estilo de cómic de ciencia ficción limpio y detallado del artista francés Moebius, con paisajes imaginativos y un sentido de la escala.' },
        { name: 'Mapa de Fantasía', prompt: 'Transforma un paisaje en un mapa de fantasía dibujado a mano, al estilo de "El Señor de los Anillos".' },
        { name: 'Estilo "Mike Mignola"', prompt: 'Aplica el estilo de alto contraste y uso intensivo de sombras de Mike Mignola ("Hellboy"), con formas angulares y audaces.' },
        { name: 'Códice Maya', prompt: 'Redibuja la imagen en el estilo de los glifos y figuras de un códice maya.' },
        { name: 'Animación Flash Antigua', prompt: 'Simula el aspecto de las primeras animaciones de internet hechas con Macromedia Flash, con gradientes vectoriales y animación "tweened".' },
        { name: 'Estilo "Nickelodeon" de los 90', prompt: 'Aplica el estilo de arte ligeramente grotesco y excéntrico de los Nicktoons de los 90 (como "Ren y Stimpy" o "Rugrats").' },
        { name: 'Arte de Vidrio Soplado', prompt: 'Reimagina al sujeto como una escultura de vidrio soplado, con formas orgánicas y colores translúcidos.' },
        { name: 'Ilustración Botánica', prompt: 'Convierte la imagen en una detallada y precisa ilustración botánica de estilo victoriano.' },
        { name: 'Estilo "Googie"', prompt: 'Aplica la estética de la era espacial de los años 50 y 60 (estilo "Googie"), con formas atómicas, ángulos agudos y un sentido de optimismo futurista.' },
    ],
    'Retro y Vintage': [
        // ... (Expanded to 50)
        { name: 'Polaroid \'79', prompt: 'Recrea el look de una fotografía Polaroid desvaída de 1979 con colores desaturados, un ligero tinte amarillo o azul, negros lechosos y el característico enfoque suave.' },
        { name: 'Daguerrotipo', prompt: 'Simula una fotografía temprana de Daguerrotipo con un look monocromático, ligeramente azulado o sepia sobre una superficie reflectante similar a la plata. Añade sutiles imperfecciones y un alto nivel de detalle.' },
        { name: 'Kodachrome 60s', prompt: 'Emula el icónico look de la película Kodachrome de los años 60 con colores ricos, vibrantes y ligeramente sobresaturados, especialmente en rojos, azules y amarillos. La imagen debe ser nítida y de alto contraste.' },
        { name: 'Cámara Lomo', prompt: 'Aplica un efecto estilo Lomography con colores sobresaturados, viñeteado intenso, alto contraste y cambios de color impredecibles, a menudo hacia magenta o cian.' },
        { name: 'Tinte Sepia', prompt: 'Dale a la imagen un tono sepia clásico y cálido para un look nostálgico de fotografía antigua de finales del siglo XIX y principios del XX.' },
        { name: 'Cianotipia', prompt: 'Transforma la imagen en una impresión de Cianotipia con su característica paleta de colores monocromática en azul cian.' },
        { name: 'Postal Antigua', prompt: 'Haz que la imagen parezca una postal coloreada y desvaída de los años 50 con colores pastel suaves, bajo contraste y una textura de papel ligeramente envejecida.' },
        { name: 'Technicolor', prompt: 'Simula el proceso Technicolor de tres tiras hipersaturado de las primeras películas de Hollywood. Los rojos, verdes y azules deben ser increíblemente ricos y vibrantes.' },
        { name: 'VHS de los 80', prompt: 'Degrada la imagen para que parezca un fotograma de una cinta VHS de los 80, con sangrado de color, líneas de escaneo, enfoque suave y una ligera aberración cromática.' },
        { name: 'Super 8mm', prompt: 'Recrea el look de una película casera en Super 8mm con una dominante de color cálida, grano de película notable, enfoque suave y un brillo ligeramente parpadeante. Añade un sutil borde de fotograma.' },
        { name: 'Autocromo', prompt: 'Simula una fotografía Autochrome Lumière, uno de los primeros procesos de color, con un look suave y pictórico y un distintivo grano puntillista compuesto por motas rojas, verdes y azules.' },
        { name: 'Foto Victoriana', prompt: 'Crea el look de una foto de tarjeta de gabinete de la era victoriana con un tinte formal sepia o de albúmina, enfoque nítido en el sujeto y una sutil viñeta oscura.' },
        { name: 'Goma Bicromatada', prompt: 'Aplica un efecto de impresión de Goma Bicromatada, un proceso del siglo XIX conocido por su calidad pictórica, detalles suaves y color monocromático o multicapa personalizable.' },
        { name: 'Tinte de Oro', prompt: 'Aplica un acabado con tono de oro, a menudo utilizado para preservar y añadir riqueza a las primeras fotografías, dando a la imagen un tono ligeramente marrón purpúreo.' },
        { name: 'Fuga de Luz', prompt: 'Añade realistas fugas de luz de estilo vintage, típicamente como rayas o manchas de luz de colores cálidos (naranja, rojo o amarillo) que provienen de los bordes del fotograma, simulando una cámara de película antigua.' },
        { name: 'Cámara "Holga"', prompt: 'Simula los efectos de una cámara de juguete Holga, con un fuerte viñeteado, fugas de luz, y un enfoque suave y a menudo impredecible en el centro.' },
        { name: 'Foto de los Años 20', prompt: 'Crea una estética de los "locos años veinte", a menudo en blanco y negro o sepia, con un enfoque suave, un estilo glamuroso y una composición formal.' },
        { name: 'Foto de los Años 50', prompt: 'Aplica una paleta de colores de los años 50, con colores pastel ligeramente desaturados (como el verde menta y el rosa pálido) y un aspecto general limpio y optimista.' },
        { name: 'Foto de los Años 70', prompt: 'Genera un look de los años 70, con una dominante de color cálida (amarillos y naranjas), un contraste bajo y un ligero grano de película.' },
        { name: 'Foto de los Años 90', prompt: 'Simula el aspecto de una foto de una cámara compacta de los 90, con colores ligeramente desaturados, un flash directo y a menudo una fecha impresa en la esquina.' },
        { name: 'Proceso de Tono de Carbono', prompt: 'Recrea una impresión al carbono, conocida por su permanencia y su rica calidad de imagen, a menudo con un aspecto monocromático profundo.' },
        { name: 'Proceso de Albúmina', prompt: 'Simula una impresión a la albúmina del siglo XIX, caracterizada por su acabado brillante y un tono amarillento o marrón en las luces.' },
        { name: 'Ambrotipo', prompt: 'Crea el aspecto de un ambrotipo, que es una imagen positiva sobre vidrio, a menudo con un aspecto fantasmal y un alto detalle.' },
        { name: 'Ferrotipo', prompt: 'Simula un ferrotipo, una fotografía en una fina hoja de hierro, caracterizada por ser una imagen positiva directa con un aspecto rústico y a menudo imperfecto.' },
        { name: 'Foto de Revista Antigua', prompt: 'Haz que la imagen parezca impresa en una revista antigua, con un patrón de semitonos visible y colores ligeramente desalineados.' },
        { name: 'Diapositiva Desvaída', prompt: 'Simula una diapositiva de color que se ha desvanecido con el tiempo, a menudo con un fuerte tinte magenta o cian.' },
        { name: 'Cámara Estenopeica', prompt: 'Recrea el efecto de una cámara estenopeica, con un enfoque infinitamente suave, viñeteado extremo y posibles distorsiones.' },
        { name: 'Cámara de Caja', prompt: 'Simula las imágenes de una simple cámara de caja de principios del siglo XX, con un enfoque suave, viñeteado y una composición simple.' },
        { name: 'Filtro Infrarrojo de Época', prompt: 'Aplica un efecto de fotografía infrarroja en blanco y negro, al estilo de los fotógrafos de mediados del siglo XX como Minor White.' },
        { name: 'Retrato Coloreado a Mano', prompt: 'Convierte la imagen a blanco y negro y luego aplica capas de color translúcido, como si hubiera sido coloreada a mano.' },
        { name: 'Look de Teletexto', prompt: 'Degrada la imagen al estilo del Teletexto de los 80, con gráficos de bloques de baja resolución y una paleta de colores muy limitada.' },
        { name: 'Gráficos de Computadora de los 80', prompt: 'Convierte la imagen a los gráficos de una computadora de 8 bits de los años 80, con dithering y una paleta de colores limitada (como CGA o EGA).' },
        { name: 'Estilo "View-Master"', prompt: 'Recrea el aspecto de una diapositiva de View-Master, con colores saturados y una ligera sensación de profundidad 3D.' },
        { name: 'Proceso "Cross-Processing" (C-41 en E-6)', prompt: 'Simula el revelado de película C-41 en química E-6, resultando en colores pastel, bajo contraste y un tinte verdoso.' },
        { name: 'Proceso "Cross-Processing" (E-6 en C-41)', prompt: 'Simula el revelado de película E-6 en química C-41, resultando en colores altamente saturados, alto contraste y cambios de color hacia el rojo y el amarillo.' },
        { name: 'Película Agfa', prompt: 'Emula la paleta de colores característica de las películas Agfa, a menudo con tonos verdes y marrones distintivos.' },
        { name: 'Película Ferrania', prompt: 'Simula el aspecto de la película italiana Ferrania, conocida por sus colores saturados y su estética de cine clásico.' },
        { name: 'Papel Fotográfico Vencido', prompt: 'Recrea el efecto de imprimir en papel fotográfico vencido, con cambios de color impredecibles, velo y manchas.' },
        { name: 'Destrucción de Emulsión', prompt: 'Simula la técnica artística de destruir físicamente la emulsión de una foto Polaroid, creando remolinos y texturas.' },
        { name: 'Aspecto de "Guerra Fría"', prompt: 'Aplica un filtro desaturado, granulado y de tonos fríos que evoca imágenes de la era de la Guerra Fría.' },
        { name: 'Foto de Crimen de los 40', prompt: 'Dale a la imagen el aspecto de una foto de escena del crimen en blanco y negro de los años 40, con un flash directo y alto contraste.' },
        { name: 'Foto de Viaje de los 60', prompt: 'Crea el aspecto de una foto de viaje de una familia de los años 60, con colores ligeramente desvaídos y una composición sincera.' },
        { name: 'Foto de Baile de Graduación de los 80', prompt: 'Aplica un filtro con enfoque suave, colores pastel y una sensación general de ensueño, típico de los retratos de graduación de los 80.' },
        { name: 'Estilo "Grunge" de los 90', prompt: 'Crea una estética de los 90 con colores desaturados, un aspecto granulado y una actitud de indiferencia, a menudo en blanco y negro.' },
        { name: 'Look "Y2K"', prompt: 'Aplica una estética de finales de los 90 y principios de los 2000, con colores plateados y azules, un aspecto futurista y a menudo un efecto de ojo de pez.' },
        { name: 'Impresión en Papel Salado', prompt: 'Simula una de las primeras técnicas fotográficas, la impresión en papel salado, que produce una imagen mate con un tono marrón y un detalle suave.' },
        { name: 'Proceso de Tono de Van Dyke', prompt: 'Recrea el proceso Van Dyke Brown, un proceso de impresión antiguo que produce imágenes de un rico color marrón oscuro.' },
        { name: 'Foto de Fotomatón', prompt: 'Simula una tira de fotos de un fotomatón, a menudo en blanco y negro, con un flash directo y alto contraste.' },
        { name: 'Postal de Lino', prompt: 'Haz que la imagen parezca una postal de "lino" de los años 30-40, con colores brillantes y saturados y una textura de superficie en relieve.' },
    ],
    'Blanco y Negro': [
        // ... (Expanded to 50)
        { name: 'Alto Contraste', prompt: 'Convierte la imagen a un blanco y negro dramático de alto contraste con negros puros y profundos y blancos limpios y brillantes, minimizando los tonos medios.' },
        { name: 'Grano Fino', prompt: 'Crea una imagen clásica en blanco y negro de bellas artes con una gama completa de tonos de negro a blanco y un grano de película muy fino y sutil para dar textura.' },
        { name: 'Infrarrojo Falso', prompt: 'Simula el efecto de la fotografía infrarroja en blanco y negro, donde el follaje (como árboles y hierba) se vuelve blanco brillante y los cielos se vuelven oscuros y dramáticos.' },
        { name: 'Platino/Paladio', prompt: 'Recrea el look de una impresión de Platino/Paladio, conocida por su amplísima gama tonal, luces suaves y delicadas, y una sensación cálida, a menudo de color gris-marrón.' },
        { name: 'Tono de Selenio', prompt: 'Aplica un sutil tono de selenio a una imagen en blanco y negro, que añade un ligero tono frío purpúreo a las sombras y aumenta la permanencia de archivo.' },
        { name: 'Look Mate', prompt: 'Genera un look contemporáneo mate en blanco y negro levantando el punto negro (haciendo que los negros sean un gris oscuro) y reduciendo la intensidad de las luces para un acabado suave y no reflectante.' },
        { name: 'Alta Clave (High Key)', prompt: 'Crea una imagen en blanco y negro de alta clave que es brillante y aireada, con un predominio de tonos blancos y grises claros y sombras mínimas.' },
        { name: 'Baja Clave (Low Key)', prompt: 'Crea una imagen en blanco y negro de baja clave que es oscura y temperamental, con un predominio de tonos negros y grises oscuros, utilizando la luz para esculpir al sujeto fuera de la oscuridad.' },
        { name: 'Arquitectura B&N', prompt: 'Optimiza la imagen para fotografía de arquitectura en blanco y negro, enfatizando líneas, texturas y formas con alto contraste y nitidez.' },
        { name: 'Retrato Clásico B&N', prompt: 'Convierte a un retrato atemporal en blanco y negro, prestando especial atención a crear tonos de piel favorecedores en monocromo y asegurando que los ojos estén nítidos y expresivos.' },
        { name: 'Tono Dividido', prompt: 'Aplica un efecto de tono dividido a la imagen en blanco y negro, añadiendo un color (ej. sepia) a las sombras y otro (ej. azul frío) a las luces.' },
        { name: 'Estilo "Ansel Adams"', prompt: 'Emula el "Sistema de Zonas" de Ansel Adams, creando un paisaje en blanco y negro con una gama tonal completa, desde el negro más profundo hasta el blanco más puro, y una nitidez increíble.' },
        { name: 'Filtro Rojo', prompt: 'Simula el uso de un filtro rojo en la cámara para la fotografía en blanco y negro, lo que oscurece dramáticamente los cielos azules y aumenta el contraste.' },
        { name: 'Filtro Verde', prompt: 'Simula el uso de un filtro verde, que aclara el follaje y proporciona una separación de tonos agradable en los retratos.' },
        { name: 'Filtro Amarillo', prompt: 'Simula el uso de un filtro amarillo, que proporciona un aumento sutil del contraste y oscurece ligeramente los cielos.' },
        { name: 'Grano Grueso', prompt: 'Aplica un grano de película en blanco y negro muy notorio y grueso, similar al de forzar una película de alta ISO como la Kodak Tri-X.' },
        { name: 'Solarización (Efecto Sabattier)', prompt: 'Simula el efecto de solarización en el cuarto oscuro, invirtiendo parcialmente los tonos de la imagen para un look surrealista.' },
        { name: 'Negros Ricos', prompt: 'Enfatiza los negros de la imagen, haciéndolos profundos, ricos y sin detalle, para un look de alto impacto.' },
        { name: 'Blancos Puros', prompt: 'Enfatiza los blancos de la imagen, haciéndolos brillantes y puros, para un look limpio y de alta clave.' },
        { name: 'Contraste Suave', prompt: 'Crea una imagen en blanco y negro de bajo contraste con una larga gama de tonos grises, para un look suave y etéreo.' },
        { name: 'Estilo "Street Photography"', prompt: 'Aplica un look de fotografía callejera en blanco y negro, a menudo con alto contraste, grano y un enfoque en capturar un momento decisivo.' },
        { name: 'Tono de Oro (en B&N)', prompt: 'Aplica un tono de oro a una imagen en blanco y negro, que añade un ligero tono cálido y una sensación de archivo.' },
        { name: 'Tono de Cobre', prompt: 'Aplica un tono de cobre, que da a la imagen un color marrón rojizo.' },
        { name: 'Tono de Hierro Azul', prompt: 'Aplica un tono de hierro, que da a la imagen un color azul frío, similar a la cianotipia pero con más gama tonal.' },
        { name: 'Proceso de Calotipo', prompt: 'Simula un calotipo de papel, uno de los primeros procesos fotográficos, que produce una imagen negativa en papel con un aspecto suave y ligeramente granulado.' },
        { name: 'Gráfico y Abstracto', prompt: 'Convierte la imagen en una composición abstracta en blanco y negro, enfatizando formas, líneas y texturas sobre el contenido literal.' },
        { name: 'Paisaje Minimalista', prompt: 'Crea un paisaje minimalista en blanco y negro, a menudo utilizando largas exposiciones para suavizar el agua y el cielo, y centrándose en formas simples.' },
        { name: 'Retrato "Film Noir"', prompt: 'Crea un retrato de estilo cine negro, con una iluminación dramática (como la luz de una persiana) y un profundo misterio.' },
        { name: 'Detalle Metálico', prompt: 'Optimiza la conversión a blanco y negro para resaltar el brillo, la forma y la textura de los objetos metálicos.' },
        { name: 'Blanco y Negro Infrarrojo Lejano', prompt: 'Simula el efecto de la fotografía infrarroja de onda larga, donde casi todo el follaje se vuelve blanco puro y el agua se vuelve negra.' },
        { name: 'Estilo "Daido Moriyama"', prompt: 'Emula el estilo de Daido Moriyama: "are, bure, boke" (granulado, borroso, desenfocado). Un look de alto contraste, granulado y a menudo borroso.' },
        { name: 'Estilo "Henri Cartier-Bresson"', prompt: 'Crea una imagen en blanco y negro con una composición impecable, una gama tonal completa y una sensación de haber capturado el "momento decisivo".' },
        { name: 'Estilo "Sebastião Salgado"', prompt: 'Aplica una conversión a blanco y negro de alto contraste y rica en tonos, con un grano fino y una calidad épica y documental.' },
        { name: 'Técnica de Aclarar y Oscurecer (Dodge & Burn)', prompt: 'Aplica un extenso trabajo de aclarar y oscurecer para esculpir la luz en la imagen, añadiendo dimensionalidad y drama.' },
        { name: 'Blanco y Negro con Viñeta Fuerte', prompt: 'Añade una viñeta oscura y pronunciada para centrar la atención en el sujeto en el centro del encuadre.' },
        { name: 'Textura de Papel de Fibra', prompt: 'Superpone una sutil textura de papel fotográfico de fibra para dar a la imagen digital una sensación de impresión física.' },
        { name: 'Negativo en Blanco y Negro', prompt: 'Invierte los tonos de la imagen para que parezca un negativo de película en blanco y negro.' },
        { name: 'Ortocromático', prompt: 'Simula el aspecto de una película ortocromática, que no es sensible a la luz roja, haciendo que los tonos de piel parezcan más oscuros y los cielos más claros.' },
        { name: 'Pancromático', prompt: 'Simula el aspecto de una película pancromática moderna, que es sensible a todos los colores de la luz, para una conversión a blanco y negro natural.' },
        { name: 'Luz de Luna en B&N', prompt: 'Crea una escena nocturna en blanco y negro que parece estar iluminada únicamente por la luz de la luna, con sombras suaves y largas.' },
        { name: 'Efecto de "Aguafuerte"', prompt: 'Transforma la imagen para que parezca un grabado al aguafuerte, con líneas finas y sombreado de eclosión.' },
        { name: 'Silueta de Alto Contraste', prompt: 'Reduce la imagen a una silueta casi pura en blanco y negro, eliminando la mayoría de los tonos medios.' },
        { name: 'Fotografía Documental', prompt: 'Aplica una conversión a blanco y negro honesta y directa, sin efectos dramáticos, adecuada para el fotoperiodismo.' },
        { name: 'Bodegón Clásico', prompt: 'Optimiza la conversión a blanco y negro para un bodegón, enfatizando la textura, la forma y la interacción de la luz en los objetos inanimados.' },
        { name: 'Infrarrojo de Falso Color (B&N)', prompt: 'Una variación artística donde los canales de una imagen infrarroja de falso color se mezclan en una imagen en blanco y negro única y de alto contraste.' },
        { name: 'Contraste Extremo', prompt: 'Lleva el contraste al máximo, creando una imagen gráfica con casi solo blanco y negro puros.' },
        { name: 'Enfoque Suave en B&N', prompt: 'Aplica un filtro de enfoque suave a una imagen en blanco y negro para un look etéreo y nostálgico, popular en el pictorialismo.' },
        { name: 'Blanco y Negro Tonal', prompt: 'Crea una imagen donde el interés principal proviene de la sutil interacción de los tonos grises, en lugar del contraste.' },
        { name: 'Estilo "Pictorialista"', prompt: 'Emula el movimiento pictorialista de finales del siglo XIX, creando una imagen en blanco y negro que se asemeja más a una pintura que a una fotografía, a menudo con enfoque suave y manipulación manual.' },
    ],
    'Artístico y Pictórico': [
        // ... (Expanded to 50)
        { name: 'Pintura al Óleo', prompt: 'Transforma la foto para que parezca una pintura al óleo clásica, con pinceladas visibles, textura rica y una paleta de colores vibrante y mezclada.' },
        { name: 'Acuarela Suave', prompt: 'Convierte la imagen en una pintura de acuarela suave y fluida, con transiciones de color suaves, bordes difusos y la apariencia de pintura sobre papel texturizado.' },
        { name: 'Estilo Cómic', prompt: 'Dale a la imagen un audaz estilo de arte de cómic, con contornos negros fuertes, sombreado plano (cel-shading) y colores primarios vibrantes y saturados.' },
        { name: 'Dibujo a Lápiz', prompt: 'Recrea la imagen como un boceto a lápiz detallado y realista, con una gama completa de tonos de grafito, desde el gris claro hasta el negro.' },
        { name: 'Impresión Xilográfica', prompt: 'Simula un estilo de grabado en madera, con formas simplificadas, contornos audaces y una paleta de colores limitada y estilizada, similar al Ukiyo-e japonés.' },
        { name: 'Mosaico de Vidrieras', prompt: 'Transforma la imagen en un mosaico de vidriera, con piezas de vidrio de colores separadas por líneas oscuras similares al plomo.' },
        { name: 'Arte Pop (Pop Art)', prompt: 'Aplica un filtro de Arte Pop inspirado en Andy Warhol, con alto contraste, colores vibrantes e inesperados y una apariencia de serigrafía.' },
        { name: 'Boceto con Carboncillo', prompt: 'Convierte la imagen en un boceto al carboncillo, caracterizado por negros ricos y oscuros, difuminados suaves y un aspecto texturizado y áspero.' },
        { name: 'Impresionismo', prompt: 'Dale a la imagen un estilo de pintura impresionista, con pinceladas cortas y visibles, un énfasis en la luz y una apariencia general suave y mezclada.' },
        { name: 'Surrealismo', prompt: 'Aplica un filtro surrealista, creando una escena onírica e ilógica mediante la distorsión de formas, el uso de colores simbólicos y la creación de yuxtaposiciones inesperadas.' },
        { name: 'Cubismo', prompt: 'Reinterpreta la imagen en un estilo cubista, descomponiendo los objetos en formas geométricas y representándolos desde múltiples puntos de vista simultáneamente.' },
        { name: 'Puntillismo', prompt: 'Transforma la imagen utilizando una técnica puntillista, construyendo la imagen a partir de miles de pequeños y distintos puntos de color.' },
        { name: 'Tinta China', prompt: 'Recrea la imagen al estilo de una pintura tradicional china de lavado de tinta, con pinceladas minimalistas, tonos de tinta variables y un enfoque en el espacio vacío.' },
        { name: 'Fresco', prompt: 'Simula el aspecto de una pintura al fresco, con colores suaves y terrosos y una textura de yeso seco.' },
        { name: 'Pintura con Espátula', prompt: 'Transforma la foto en una pintura al óleo hecha con espátula, con pinceladas gruesas y texturizadas (empaste).' },
        { name: 'Dibujo con Pluma y Tinta', prompt: 'Convierte la imagen en un dibujo a tinta, utilizando técnicas de sombreado como el rayado y el puntillismo.' },
        { name: 'Pastel al Óleo', prompt: 'Simula un dibujo hecho con pasteles al óleo, con colores vibrantes y una textura cerosa y mezclada.' },
        { name: 'Pintura Acrílica', prompt: 'Recrea el aspecto de una pintura acrílica, con colores brillantes y opacos y pinceladas nítidas.' },
        { name: 'Gouache', prompt: 'Simula una pintura al gouache, que tiene un acabado mate y opaco, a menudo utilizado en ilustración.' },
        { name: 'Collage de Papel Rasgado', prompt: 'Recrea la imagen como un collage hecho de trozos de papel de colores rasgados.' },
        { name: 'Aerografía', prompt: 'Transforma la imagen para que parezca hecha con aerógrafo, con gradientes suaves y un aspecto pulido.' },
        { name: 'Pintura Rupestre', prompt: 'Redibuja la imagen en el estilo de una pintura rupestre prehistórica, con pigmentos terrosos y formas simplificadas.' },
        { name: 'Mosaico de Azulejos', prompt: 'Convierte la imagen en un mosaico hecho de pequeños azulejos de cerámica.' },
        { name: 'Estilo "Alphonse Mucha"', prompt: 'Aplica el estilo Art Nouveau de Alphonse Mucha, con líneas fluidas, motivos florales y una paleta de colores pastel.' },
        { name: 'Estilo "Gustav Klimt"', prompt: 'Recrea el estilo de Gustav Klimt, con patrones ornamentados, pan de oro y un aspecto decorativo y simbólico.' },
        { name: 'Estilo "Piet Mondrian"', prompt: 'Simplifica la imagen en una composición abstracta de líneas negras y bloques de colores primarios, al estilo de Mondrian.' },
        { name: 'Estilo "Jackson Pollock"', prompt: 'Transforma la imagen en una pintura abstracta de goteo y salpicadura al estilo de Jackson Pollock.' },
        { name: 'Estilo "Frida Kahlo"', prompt: 'Aplica un estilo de realismo mágico y autorretrato simbólico inspirado en Frida Kahlo, a menudo con elementos de la naturaleza y el folclore mexicano.' },
        { name: 'Estilo "Hieronymus Bosch"', prompt: 'Transforma la escena en un paisaje fantástico y densamente poblado de criaturas extrañas, al estilo de El Bosco.' },
        { name: 'Estilo "Salvador Dalí"', prompt: 'Aplica una estética surrealista con objetos que se derriten, paisajes oníricos y una precisión casi fotográfica en los detalles.' },
        { name: 'Grabado (Aguafuerte)', prompt: 'Simula un grabado al aguafuerte, con líneas finas y detalladas y un aspecto de impresión entintada.' },
        { name: 'Litografía', prompt: 'Recrea el aspecto de una litografía, con una calidad de dibujo suave y tonal.' },
        { name: 'Serigrafía', prompt: 'Simula una serigrafía, con áreas planas de color audaz y capas superpuestas.' },
        { name: 'Bordado', prompt: 'Transforma la imagen para que parezca bordada con hilo sobre tela.' },
        { name: 'Arte con Cuentas', prompt: 'Recrea la imagen como si estuviera hecha de pequeñas cuentas de colores.' },
        { name: 'Escultura de Arcilla', prompt: 'Reimagina al sujeto como una escultura de arcilla o terracota.' },
        { name: 'Arte de Arena', prompt: 'Transforma la imagen en un diseño hecho con arenas de colores.' },
        { name: 'Talla de Madera', prompt: 'Recrea al sujeto como si estuviera tallado en madera, con vetas y texturas visibles.' },
        { name: 'Pirograbado', prompt: 'Simula el arte de quemar un diseño en madera (pirograbado).' },
        { name: 'Dibujo de Libro de Anatomía', prompt: 'Redibuja al sujeto en el estilo de un antiguo grabado de un libro de anatomía.' },
        { name: 'Tarot', prompt: 'Transforma la imagen en una carta del tarot, con un estilo simbólico y arquetípico.' },
        { name: 'Póster de Rock Psicodélico', prompt: 'Aplica un estilo psicodélico de los años 60, con colores vibrantes, letras fluidas y formas arremolinadas.' },
        { name: 'Mancha de Tinta (Rorschach)', prompt: 'Transforma la imagen en una mancha de tinta simétrica y ambigua, como un test de Rorschach.' },
        { name: 'Expresionismo Abstracto', prompt: 'Convierte la imagen en una pintura no representacional que se centra en el color, la forma y el gesto.' },
        { name: 'Minimalismo', prompt: 'Reduce la imagen a sus elementos esenciales de forma y color, creando una composición simple y limpia.' },
        { name: 'Op Art (Arte Óptico)', prompt: 'Transforma la imagen en un diseño de Op Art que crea ilusiones ópticas de movimiento o patrones ocultos.' },
        { name: 'Fauvismo', prompt: 'Aplica un estilo fauvista, utilizando colores intensos y no naturalistas para expresar emociones.' },
        { name: 'Barroco', prompt: 'Recrea la imagen con el drama, el movimiento y el claroscuro intenso de la pintura barroca.' },
        { name: 'Romanticismo', prompt: 'Aplica un estilo romántico, enfatizando la emoción, la naturaleza y lo sublime.' },
    ],
    'Moderno y Urbano': [
        // ... (Expanded to 50)
        { name: 'Brillo de Neón', prompt: 'Mejora la imagen con vibrantes luces de neón y reflejos, creando una escena nocturna urbana ciberpunk o futurista. Enfatiza los azules, rosas y morados.' },
        { name: 'Estilo Grunge', prompt: 'Aplica un filtro grunge urbano y crudo con alto contraste, colores desaturados, textura o grano añadido y una sensación general ruda y vanguardista.' },
        { name: 'Doble Exposición', prompt: 'Mezcla creativamente la imagen principal con una segunda imagen complementaria (como un paisaje urbano o un bosque) en un efecto de doble exposición sin fisuras.' },
        { name: 'Cyberpunk', prompt: 'Crea una estética ciberpunk distópica y de alta tecnología con una paleta de colores oscuros salpicada de brillantes y sobresaturadas luces de neón. Añade elementos como artefactos digitales o aberración cromática.' },
        { name: 'Callejero Vívido', prompt: 'Aplica un filtro de alto contraste y alta claridad que hace que la fotografía callejera destaque. Realza las texturas, profundiza las sombras y haz que los colores sean vibrantes sin ser irreales.' },
        { name: 'Minimalismo Frío', prompt: 'Crea un look limpio y minimalista con una paleta de colores fría y desaturada, blancos brillantes y un enfoque en composiciones simples y espacio negativo.' },
        { name: 'Look "Bleach Bypass"', prompt: 'Simula la técnica de procesamiento de película "bleach bypass" para un look de alto contraste, desaturado y crudo con un brillo metálico, popular en películas de acción y ciencia ficción.' },
        { name: 'Infrarrojo Urbano', prompt: 'Aplica un efecto de infrarrojo de falso color adecuado para paisajes urbanos, convirtiendo los cielos en azul profundo o rojo y dando a los edificios una apariencia surrealista y de alto contraste.' },
        { name: 'Reflejos de Lluvia', prompt: 'Mejora o añade reflejos en calles mojadas después de una lluvia. Aumenta el contraste, la saturación en las luces reflejadas y crea una atmósfera temperamental y cinematográfica.' },
        { name: 'Glitch Art', prompt: 'Introduce efectos de glitch digital como ordenación de píxeles, datamoshing y desplazamiento de canales de color para una estética caótica, moderna y centrada en la tecnología.' },
        { name: 'Vaporwave', prompt: 'Aplica una estética Vaporwave, con colores pastel de neón (rosa y cian), motivos de estatuas romanas, y una sensación de nostalgia por la tecnología de los 80 y 90.' },
        { name: 'Arquitectura Brutalista', prompt: 'Enfatiza las texturas de hormigón, las sombras duras y las formas geométricas de la arquitectura brutalista, a menudo en blanco y negro de alto contraste.' },
        { name: 'Trazas de Luz', prompt: 'Simula una larga exposición en una escena urbana nocturna para crear estelas de luz de los coches y otros vehículos en movimiento.' },
        { name: 'Efecto "Tilt-Shift"', prompt: 'Aplica un efecto de "tilt-shift" que desenfoca la parte superior e inferior de la imagen, haciendo que una escena urbana parezca una maqueta en miniatura.' },
        { name: 'Contraste Urbano', prompt: 'Aumenta drásticamente el contraste y la claridad para resaltar las texturas del metal, el ladrillo y el asfalto en un entorno urbano.' },
        { name: 'Paleta de Colores "Miami Vice"', prompt: 'Aplica una paleta de colores de los 80 inspirada en "Miami Vice", con un predominio de rosas pastel, azules y neones.' },
        { name: 'Estilo "Skater"', prompt: 'Crea un look de fotografía de skate, a menudo con un objetivo gran angular (efecto ojo de pez), colores saturados y una sensación de acción cruda.' },
        { name: 'Graffiti Vívido', prompt: 'Aumenta la saturación y el contraste del arte del graffiti para que los colores resalten de las paredes.' },
        { name: 'Exploración Urbana (Urbex)', prompt: 'Aplica un filtro desaturado, granulado y de alto contraste que enfatiza el decaimiento y la atmósfera de los lugares abandonados.' },
        { name: 'Paisaje Nocturno Urbano', prompt: 'Optimiza una foto nocturna de una ciudad, equilibrando las luces artificiales, profundizando los cielos y controlando los reflejos.' },
        { name: 'Look Industrial', prompt: 'Crea un look frío y desaturado con un tinte metálico o azulado, enfatizando las texturas de las fábricas, almacenes y maquinaria.' },
        { name: 'Neón y Charcos', prompt: 'Combina luces de neón brillantes con reflejos en charcos o calles mojadas para una estética clásica de ciberpunk o cine negro.' },
        { name: 'Minimalismo Arquitectónico', prompt: 'Simplifica una foto de arquitectura a líneas y formas limpias, a menudo con un cielo despejado y una paleta de colores limitada.' },
        { name: 'Moda Callejera', prompt: 'Aplica un filtro moderno y de alto contraste que hace que la ropa y los sujetos destaquen en un entorno urbano.' },
        { name: 'Estilo "Hip-Hop" de los 90', prompt: 'Emula la estética de los videos de hip-hop de los 90, a menudo con un objetivo gran angular, colores saturados y una perspectiva de ángulo bajo.' },
        { name: 'Look de "Vigilante"', prompt: 'Crea una atmósfera oscura, granulada y descarnada de una ciudad por la noche, como si fuera vista por un vigilante.' },
        { name: 'Tráfico en Movimiento', prompt: 'Aplica un desenfoque de movimiento a los coches y a la gente para crear una sensación de bullicio y energía en la ciudad.' },
        { name: 'Hora Azul Urbana', prompt: 'Enfatiza el momento de la "hora azul" en una ciudad, cuando el cielo tiene un azul profundo y las luces de los edificios empiezan a brillar.' },
        { name: 'Detalle de Textura Urbana', prompt: 'Aplica un filtro de microcontraste para resaltar cada grieta, ladrillo y textura de la superficie en un entorno urbano.' },
        { name: 'Perspectiva Forzada', prompt: 'Mejora la sensación de altura y profundidad en las fotos de rascacielos y calles de la ciudad.' },
        { name: 'Sol de Atardecer entre Edificios', prompt: 'Crea el efecto de un sol bajo de atardecer que se filtra entre los edificios, creando largos destellos de lente y sombras.' },
        { name: 'Estilo "Lo-Fi"', prompt: 'Aplica un filtro de baja fidelidad, con colores desvaídos, grano y una sensación de nostalgia y calma, a menudo asociado con la música Lo-Fi.' },
        { name: 'Noche de Tokio', prompt: 'Recrea la icónica estética nocturna de Tokio, con una sobrecarga de letreros de neón, reflejos y una paleta de colores fría.' },
        { name: 'Estilo de Vida Urbano', prompt: 'Aplica un filtro cálido y ligeramente desaturado que es popular en los blogs de estilo de vida y en Instagram para la fotografía urbana.' },
        { name: 'Subterráneo/Metro', prompt: 'Crea una atmósfera de estación de metro, con iluminación fluorescente, colores apagados y una sensación de movimiento y fugacidad.' },
        { name: 'Futurismo Retro', prompt: 'Combina elementos de diseño futurista con una estética retro, como coches voladores de los años 50 o robots de estilo Art Déco.' },
        { name: 'Ciudad Gótica', prompt: 'Transforma una ciudad en una metrópolis gótica y oscura, con arquitectura puntiaguda, sombras profundas y una atmósfera ominosa.' },
        { name: 'Metrópolis Soleada', prompt: 'Crea un look de ciudad brillante y soleada, con colores vibrantes, cielos azules y una energía positiva.' },
        { name: 'Silueta Urbana', prompt: 'Convierte el horizonte de la ciudad en una silueta nítida contra un cielo de atardecer o amanecer.' },
        { name: 'Reflejos en Ventanas', prompt: 'Enfatiza o crea reflejos interesantes en las ventanas de los edificios, a menudo mostrando la vida de la calle o el cielo.' },
        { name: 'Parque Urbano', prompt: 'Equilibra los elementos naturales y artificiales de un parque en la ciudad, realzando los verdes del follaje y las texturas de los edificios circundantes.' },
        { name: 'Estilo "Synthwave"', prompt: 'Aplica una estética de los 80 inspirada en el Synthwave, con una rejilla de perspectiva, un sol de atardecer y una paleta de colores de neón rosa, morado y azul.' },
        { name: 'Distopía Concreta', prompt: 'Crea una visión distópica de una ciudad, con edificios de hormigón imponentes, un cielo nublado y una paleta de colores desaturada y opresiva.' },
        { name: 'Utopía Ecológica', prompt: 'Transforma una ciudad en una utopía verde, con edificios cubiertos de vegetación y una atmósfera limpia y brillante.' },
        { name: 'Festival Urbano', prompt: 'Captura la energía de un festival de música o un evento en la calle, con colores vibrantes, desenfoque de movimiento y una sensación de multitud.' },
        { name: 'Cafetería Acogedora', prompt: 'Aplica un filtro cálido y acogedor que simula el ambiente de una cafetería, con tonos de madera, luz suave y un ligero vapor.' },
        { name: 'Look de "Cámara de Seguridad"', prompt: 'Degrada la imagen para que parezca que fue capturada por una cámara de seguridad, con baja resolución, distorsión de barril y una marca de tiempo.' },
        { name: 'Ciudad de Noche (Larga Exposición)', prompt: 'Simula una fotografía de larga exposición de una ciudad por la noche desde un punto de vista alto, suavizando el tráfico en ríos de luz.' },
        { name: 'Hora Punta', prompt: 'Transmite el caos y el movimiento de la hora punta, con desenfoque de movimiento y una composición densa.' },
        { name: 'Callejón de Lluvia y Neón', prompt: 'El look por excelencia del ciberpunk: un callejón oscuro, mojado por la lluvia, iluminado únicamente por los reflejos de los letreros de neón cercanos.' },
    ],
    'Naturaleza y Paisaje': [
        // ... (Expanded to 50)
        { name: 'Bosque Encantado', prompt: 'Crea una atmósfera mágica y encantada de bosque. Añade rayos de luz suaves y etéreos (rayos crepusculares) filtrándose a través de los árboles, realza los verdes y dale una sensación ligeramente onírica.' },
        { name: 'Atardecer Dramático', prompt: 'Realza los colores de un atardecer o amanecer, intensificando los rojos, naranjas y morados en el cielo y las nubes para un efecto dramático e impresionante.' },
        { name: 'Costa Brumosa', prompt: 'Aplica un filtro temperamental y atmosférico para escenas costeras. Desatura ligeramente los colores, añade un tono azul frío e introduce una capa de niebla o bruma suave.' },
        { name: 'Prados Esmeralda', prompt: 'Realza dramáticamente los verdes y amarillos en un paisaje para crear campos y prados exuberantes y vibrantes de color verde esmeralda, que recuerdan a Irlanda.' },
        { name: 'Montañas Majestuosas', prompt: 'Aumenta la claridad, el contraste y añade un ligero tinte azul a las sombras para enfatizar la escala, la textura y la majestuosidad de las montañas.' },
        { name: 'Desierto Dorado', prompt: 'Aplica un filtro cálido y dorado a los paisajes desérticos. Realza los tonos naranjas y rojos de la arena y la roca, y aumenta el contraste para un look quemado por el sol.' },
        { name: 'Invierno Escarchado', prompt: 'Crea un look invernal nítido y frío. Añade una dominante de color azul frío, aumenta el brillo de los blancos y la nieve, y realza los detalles en el hielo y la escarcha.' },
        { name: 'Jungla Vibrante', prompt: 'Aumenta la saturación y la riqueza de todos los colores, especialmente los verdes y los colores de las flores tropicales, para crear una atmósfera de jungla densa, vibrante y húmeda.' },
        { name: 'Aurora Boreal', prompt: 'Mejora o añade un efecto realista de Aurora Boreal (Luces del Norte) a un cielo nocturno, con cortinas de luz brillantes de color verde y morado.' },
        { name: 'Paisaje Submarino', prompt: 'Optimiza para fotografía submarina restaurando el color (especialmente rojos y amarillos), aumentando la claridad, reduciendo la retrodispersión y realzando los tonos azules profundos.' },
        { name: 'Campo de Flores', prompt: 'Haz que un campo de flores estalle de color. Aumenta selectivamente la saturación y la vitalidad de los colores de las flores manteniendo los verdes naturales.' },
        { name: 'Cielo Estrellado (Vía Láctea)', prompt: 'Realza un cielo nocturno para que la Vía Láctea sea claramente visible, aumentando el contraste y la claridad de las estrellas y nebulosas.' },
        { name: 'Cascada Sedosa', prompt: 'Simula una larga exposición para dar a una cascada o a un río un aspecto suave, lechoso y sedoso.' },
        { name: 'Cañón del Suroeste', prompt: 'Acentúa los tonos rojos, naranjas y marrones de las formaciones rocosas de un cañón, y aumenta el contraste para definir las capas.' },
        { name: 'Colores de Otoño', prompt: 'Intensifica los colores del follaje de otoño, haciendo que los rojos, naranjas y amarillos sean más vibrantes.' },
        { name: 'Playa Tropical', prompt: 'Crea una imagen de playa tropical de ensueño, con aguas turquesas, arenas blancas y cielos azules brillantes.' },
        { name: 'Volcán Dramático', prompt: 'Añade un brillo de lava, humo y una atmósfera ominosa a un paisaje volcánico.' },
        { name: 'Lago Glaciar', prompt: 'Realza el color azul o verde lechoso y único de un lago glaciar y las montañas escarpadas que lo rodean.' },
        { name: 'Pantano Misterioso', prompt: 'Crea una atmósfera de pantano misterioso y temperamental, con niebla, reflejos en el agua estancada y una paleta de colores verdes y marrones.' },
        { name: 'Sabana Africana', prompt: 'Aplica un filtro cálido y dorado que evoca la sensación de un atardecer en la sabana africana, con colores desaturados y un sol bajo.' },
        { name: 'Cueva Mágica', prompt: 'Ilumina una cueva oscura con una luz misteriosa y de otro mundo, resaltando formaciones rocosas y quizás cristales brillantes.' },
        { name: 'Paisaje de Tundra', prompt: 'Crea un paisaje de tundra vasto y desolado, con colores apagados, un cielo amplio y una sensación de frío y lejanía.' },
        { name: 'Arrecife de Coral', prompt: 'Aumenta drásticamente la saturación y la claridad de los colores de un arrecife de coral para que la vida marina destaque.' },
        { name: 'Tormenta de Arena', prompt: 'Simula una tormenta de arena, con un fuerte tinte naranja-marrón, visibilidad reducida y una sensación de viento y movimiento.' },
        { name: 'Bosque de Secuoyas', prompt: 'Captura la escala y la majestuosidad de un bosque de secuoyas, con rayos de luz que se filtran a través de los árboles altos y una rica paleta de colores terrosos.' },
        { name: 'Glaciar de Hielo Azul', prompt: 'Realza el denso hielo azul de un glaciar, aumentando el contraste y la saturación de los tonos azules.' },
        { name: 'Amanecer en la Montaña', prompt: 'Captura el primer resplandor del amanecer (alpenglow) en los picos de las montañas, con rosas y naranjas vibrantes.' },
        { name: 'Campo de Lavanda', prompt: 'Intensifica los púrpuras y los verdes de un campo de lavanda para una imagen vibrante y fragante.' },
        { name: 'Río Serpenteante', prompt: 'Utiliza un filtro polarizador simulado para reducir los reflejos y realzar los colores y la claridad de un río visto desde arriba.' },
        { name: 'Bosque Quemado', prompt: 'Crea una imagen sombría pero hermosa de un bosque después de un incendio, a menudo en blanco y negro de alto contraste para enfatizar las texturas.' },
        { name: 'Géiser en Erupción', prompt: 'Aumenta el contraste y la claridad del agua y el vapor de un géiser en erupción contra el cielo.' },
        { name: 'Salinas', prompt: 'Crea un paisaje surrealista y minimalista de unas salinas, con blancos brillantes y reflejos especulares.' },
        { name: 'Cenote Mexicano', prompt: 'Captura la belleza de un cenote, con rayos de sol que penetran en aguas cristalinas y azules profundos.' },
        { name: 'Paisaje de Viñedos', prompt: 'Realza las hileras y los colores de un viñedo, especialmente durante el otoño o la hora dorada.' },
        { name: 'Cosecha Dorada', prompt: 'Aplica un filtro cálido y dorado a un campo de trigo o cebada listo para la cosecha.' },
        { name: 'Arcoíris Vívido', prompt: 'Añade o realza un arcoíris en la escena, asegurando que sus colores sean vibrantes y se mezclen de forma natural con el cielo.' },
        { name: 'Luna sobre el Agua', prompt: 'Crea el reflejo de la luna en un cuerpo de agua tranquilo por la noche.' },
        { name: 'Hojas Escarchadas', prompt: 'Aplica un filtro que realza el delicado detalle de la escarcha en las hojas y las plantas.' },
        { name: 'Nubes de Tormenta', prompt: 'Aumenta el contraste y la estructura de las nubes de tormenta para un aspecto dramático y ominoso.' },
        { name: 'Reflejo de Montaña', prompt: 'Crea un reflejo perfecto de una montaña en un lago en calma, asegurando la simetría y la claridad.' },
        { name: 'Rocas Musgosas', prompt: 'Realza la textura y el verde vibrante del musgo que crece en las rocas o los árboles.' },
        { name: 'Camino en el Bosque', prompt: 'Guía la vista del espectador por un camino en el bosque, utilizando la luz y la sombra para crear profundidad.' },
        { name: 'Fauna Salvaje', prompt: 'Aplica un filtro que hace que un animal salvaje destaque de su entorno, a menudo con un enfoque nítido y un fondo suavemente desenfocado.' },
        { name: 'Macrofotografía de Naturaleza', prompt: 'Realza los detalles extremos en sujetos pequeños como insectos o gotas de rocío.' },
        { name: 'Dunas de Arena', prompt: 'Enfatiza las curvas, las sombras y las texturas de las dunas de arena, especialmente con luz de ángulo bajo.' },
        { name: 'Paisaje Aéreo', prompt: 'Optimiza una foto tomada desde un avión o un dron, reduciendo la neblina y realzando los patrones en el suelo.' },
        { name: 'Tornado Amenazante', prompt: 'Crea o realza la forma dramática y el color oscuro de un tornado contra un cielo de tormenta.' },
        { name: 'Cielo de Atardecer Pastel', prompt: 'Crea un atardecer suave y soñador con colores pastel como el rosa, el lavanda y el azul pálido.' },
        { name: 'Bosque de Bambú', prompt: 'Enfatiza las líneas verticales y los verdes vibrantes de un bosque de bambú.' },
        { name: 'Eclipse Solar', prompt: 'Simula el aspecto de un eclipse solar total, con la corona del sol visible alrededor de una silueta oscura.' },
    ]
};

const categoryTooltips: Record<FilterCategory, string> = {
    'Cinematográfico': 'Filtros inspirados en géneros y estilos de películas famosas.',
    'Animación y Dibujos': 'Estilos que simulan dibujos animados, anime, cómics y más.',
    'Retro y Vintage': 'Looks que emulan procesos fotográficos y cámaras de épocas pasadas.',
    'Blanco y Negro': 'Conversiones a monocromo con diferentes estilos y tonalidades.',
    'Artístico y Pictórico': 'Transforma tu foto para que parezca una obra de arte manual.',
    'Moderno y Urbano': 'Estilos contemporáneos, ideales para fotografía callejera y de ciudad.',
    'Naturaleza y Paisaje': 'Filtros optimizados para realzar escenas de exterior y paisajes.',
};


const FilterPanel: React.FC<FilterPanelProps> = ({ onApplyFilter, isLoading, currentImage, isPhotoshootMode, selectionCount }) => {
  const [selectedPresets, setSelectedPresets] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('Cinematográfico');

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recommendations, setRecommendations] = useState<{ presetName: string, reason: string }[] | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisContext, setAnalysisContext] = useState('');

  const getActivePrompts = () => {
    const activePrompts = [...selectedPresets];
    if (customPrompt.trim()) {
      activePrompts.push(customPrompt);
    }
    return activePrompts;
  };
  const activePrompts = getActivePrompts();

  const handlePresetClick = (prompt: string) => {
    setSelectedPresets(prev => 
        prev.includes(prompt) 
            ? prev.filter(p => p !== prompt)
            : [...prev, prompt]
    );
  };
  
  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomPrompt(e.target.value);
  };

  const handleApply = () => {
    const promptsToApply = getActivePrompts();
    if (promptsToApply.length > 0) {
      const combinedPrompt = promptsToApply.join(', y además ');
      onApplyFilter(combinedPrompt);
    }
  };

  const handleAnalyzeImage = async () => {
    if (!currentImage || isAnalyzing || isLoading) return;
    setIsAnalyzing(true);
    setAnalysisError(null);
    setRecommendations(null);
    try {
        const allPresets = Object.values(presetsByCategory).flat();
        const results = await getAIFilterRecommendations(currentImage, allPresets, analysisContext);
        const validRecommendations = results.filter(rec => rec.presetName && allPresets.some(p => p.name === rec.presetName));
        setRecommendations(validRecommendations);
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error desconocido';
        setAnalysisError(`La IA no pudo analizar la imagen. ${msg}`);
    } finally {
        setIsAnalyzing(false);
    }
  };

  const getButtonText = () => {
    if (!isPhotoshootMode) {
      return 'Aplicar';
    }
    if (selectionCount > 1) {
      return `Aplicar en Lote (${selectionCount})`;
    }
    if (selectionCount === 1) {
      return 'Aplicar a Selección';
    }
    return 'Aplicar'; // Fallback, should be disabled
  };

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-4 animate-fade-in backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-center text-gray-300">Aplica un Filtro Creativo</h3>
      <p className="text-sm text-center text-gray-400 -mt-2">Combina filtros o deja que la IA te recomiende los mejores.</p>

      {/* AI Recommendation Section */}
      <div className="w-full bg-gray-900/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <SparkleIcon className="w-10 h-10 text-blue-400 flex-shrink-0" />
            <div className="flex-grow">
                <h4 className="font-bold text-gray-100">Asistente de IA para Filtros</h4>
                <p className="text-sm text-gray-400">Pide a la IA que analice tu foto y te sugiera los filtros más adecuados.</p>
            </div>
             <button
                onClick={handleAnalyzeImage}
                disabled={isLoading || isAnalyzing || (!currentImage && !isPhotoshootMode)}
                className="w-full sm:w-auto ml-auto flex-shrink-0 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg transition-all duration-200 shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 disabled:bg-blue-800 disabled:cursor-not-allowed disabled:shadow-none"
            >
                {isAnalyzing ? 'Analizando...' : 'Sugerir Filtros'}
            </button>
        </div>
        <input
            type="text"
            value={analysisContext}
            onChange={(e) => setAnalysisContext(e.target.value)}
            placeholder="Contexto opcional (ej. 'quiero un look vintage', 'para Instagram')"
            className="w-full bg-gray-800 border border-gray-600 text-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none transition disabled:opacity-60 text-sm"
            disabled={isLoading || isAnalyzing}
            title="Describe el objetivo o el estilo que buscas para obtener mejores recomendaciones."
        />
      </div>
      {analysisError && <p className="text-center text-red-400 text-sm">{analysisError}</p>}


      <div className="flex flex-wrap items-center justify-center gap-2 border-b border-gray-700 pb-3">
        {(Object.keys(presetsByCategory) as FilterCategory[]).map(category => (
            <button
                key={category}
                onClick={() => setActiveCategory(category)}
                title={categoryTooltips[category]}
                className={`px-3 py-2 text-sm font-semibold rounded-md transition-colors duration-200 ${
                    activeCategory === category 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-300 hover:bg-white/10'
                }`}
            >
                {category}
            </button>
        ))}
      </div>
      
      {recommendations && recommendations.length > 0 && (
          <p className="text-center font-semibold text-yellow-300 text-sm animate-fade-in">✨ ¡La IA recomienda estos filtros!</p>
      )}
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-60 overflow-y-auto pr-2">
        {presetsByCategory[activeCategory].map(preset => {
            const recommendation = recommendations?.find(r => r.presetName === preset.name);
            const isRecommended = !!recommendation;
            return (
              <button
                key={preset.name}
                onClick={() => handlePresetClick(preset.prompt)}
                disabled={isLoading}
                title={isRecommended ? `${preset.prompt}\n\n✨ IA Recomienda: ${recommendation.reason}` : preset.prompt}
                className={`relative w-full text-left bg-white/10 border text-gray-200 font-semibold py-2 px-3 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 active:scale-95 text-sm disabled:opacity-50 disabled:cursor-not-allowed ${selectedPresets.includes(preset.prompt) ? 'border-blue-500 ring-2 ring-blue-500 bg-blue-500/10' : 'border-transparent hover:border-white/20'} ${isRecommended ? '!border-yellow-400/80 !ring-2 !ring-yellow-400/70 bg-yellow-900/20' : ''}`}
              >
                {isRecommended && <SparkleIcon className="w-3 h-3 absolute top-1.5 right-1.5 text-yellow-300" />}
                {preset.name}
              </button>
            );
        })}
      </div>

      <div className="flex gap-2">
        <input
            type="text"
            value={customPrompt}
            onChange={handleCustomChange}
            placeholder="O describe un filtro personalizado..."
            className="flex-grow bg-gray-800 border border-gray-600 text-gray-200 rounded-lg p-4 focus:ring-2 focus:ring-blue-500 focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60 text-base"
            disabled={isLoading}
            title="Describe el filtro que quieres aplicar, por ejemplo: 'Efecto de película antigua en blanco y negro'."
        />
        <button
            onClick={handleApply}
            className="w-auto bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
            disabled={isLoading || activePrompts.length === 0 || (isPhotoshootMode && selectionCount === 0)}
            title={isPhotoshootMode && selectionCount === 0 ? "Selecciona una o más imágenes del carrusel para aplicar." : "Aplica los filtros a la imagen."}
        >
            {getButtonText()}
        </button>
      </div>
    </div>
  );
};

export default FilterPanel;