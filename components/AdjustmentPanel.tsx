/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useMemo } from 'react';
// FIX: Imported `AIRecommendation` from its defining module to resolve the export error.
import { getAIRecommendations } from '../services/geminiService';
import type { AIRecommendation } from './story-builder/types';
import { SparkleIcon } from './icons';

interface AdjustmentPanelProps {
  onApplyAdjustment: (prompt: string) => void;
  isLoading: boolean;
  currentImage: File | null;
  isPhotoshootMode: boolean;
  selectionCount: number;
}

type AdjustmentCategory = 'Iluminación y Atmósfera' | 'Color y Tono' | 'Retrato' | 'Detalle y Textura' | 'Artístico y Creativo';

const presetsByCategory: Record<AdjustmentCategory, { name: string, prompt: string, description: string }[]> = {
  'Iluminación y Atmósfera': [
    { name: 'Integrar con Fondo', prompt: 'Actúa como un compositor profesional. Analiza la iluminación, la temperatura de color y las condiciones ambientales del fondo. Luego, ajusta meticulosamente el sujeto principal para que coincida perfectamente con el entorno. Esto incluye corregir la dirección de la luz, la suavidad/dirección de las sombras, el balance de color y añadir reflejos sutiles o luz rebotada del entorno para crear una composición completamente fluida y fotorrealista.', description: 'Ajusta la luz, sombra y color del sujeto para que coincida perfectamente con el fondo, creando un fotomontaje realista.' },
    // Existing 10
    { name: 'Hora Dorada', prompt: 'Adjust the color temperature and lighting to replicate the warm, soft glow of the golden hour.', description: 'Crea una atmósfera cálida y nostálgica, perfecta para fotos al atardecer.' },
    { name: 'Luz de Estudio', prompt: 'Add dramatic, professional studio lighting to the main subject.', description: 'Simula una iluminación de estudio profesional para un look pulido y enfocado.' },
    { name: 'Sombras Dramáticas', prompt: 'Increase the contrast and deepen the shadows to create a dramatic, high-impact look, similar to chiaroscuro lighting.', description: 'Para un efecto de alto contraste y misterio.' },
    { name: 'Brillo Cinematográfico', prompt: 'Apply a soft, cinematic bloom effect to the highlights, giving the image a dreamy, professional film look.', description: 'Añade un toque de película y suavidad a las luces altas.' },
    { name: 'Hora Azul', prompt: 'Evoke the feeling of the "blue hour" just after sunset with deep blue and purple tones and soft, cool lighting.', description: 'Ideal para paisajes urbanos o retratos con una atmósfera melancólica y fría.' },
    { name: 'Luz de Neón', prompt: 'Introduce vibrant, stylized neon lighting, casting colorful glows on the subject and environment.', description: 'Perfecto para un look futurista, ciberpunk o de fiesta nocturna.' },
    { name: 'Día Soleado', prompt: 'Make the image look like it was taken on a bright, sunny day with crisp light and vibrant colors.', description: 'Aumenta el brillo y la vivacidad para simular un día claro y alegre.' },
    { name: 'Noche Misteriosa', prompt: 'Transform the scene into a mysterious night setting with deep shadows, muted colors, and selective highlights (like moonlight).', description: 'Convierte una foto de día en una escena nocturna intrigante.' },
    { name: 'Niebla Sutil', prompt: 'Add a layer of subtle, realistic fog or mist to create a sense of depth and atmosphere.', description: 'Añade misterio o calma a paisajes y escenas de exterior.' },
    { name: 'Luz de Vela', prompt: 'Bathe the scene in the warm, flickering, and intimate light of a candle.', description: 'Crea un ambiente íntimo y cálido, ideal para retratos o bodegones.' },
    // New 40
    { name: 'Luz de Ventana', prompt: 'Simulate soft, diffused light coming from a large window, creating gentle shadows and a natural, indoor feel.', description: 'Crea una iluminación suave y natural, ideal para retratos introspectivos.' },
    { name: 'Contraluz (Silueta)', prompt: 'Create a strong backlight to turn the subject into a silhouette against a bright background.', description: 'Genera siluetas impactantes contra un fondo brillante.' },
    { name: 'Luz Rembrandt', prompt: 'Apply classic Rembrandt lighting to a portrait, characterized by a small, inverted triangle of light on the cheek opposite the light source.', description: 'Iluminación de retrato clásica y dramática que esculpe el rostro.' },
    { name: 'Mediodía Duro', prompt: 'Recreate the harsh, high-contrast light of midday, with sharp shadows and bright highlights.', description: 'Para un look intenso y energético, típico del mediodía.' },
    { name: 'Amanecer Frío', prompt: 'Generate the cool, crisp light of early dawn, with soft pinks and blues in the sky.', description: 'Simula la luz fresca y prometedora de las primeras horas del día.' },
    { name: 'Atardecer Ardiente', prompt: 'Intensify sunset colors to create a fiery, dramatic sky with deep reds and oranges.', description: 'Para atardeceres espectaculares con colores intensos.' },
    { name: 'Cielo Nublado', prompt: 'Create soft, even, and diffused lighting characteristic of an overcast day, reducing harsh shadows.', description: 'Luz suave y uniforme, ideal para retratos sin sombras duras.' },
    { name: 'Reflejos Acuáticos', prompt: 'Add the shimmering, caustic light reflections that bounce off a water surface.', description: 'Añade el efecto de luz reflejada en el agua, ideal para escenas de piscina o playa.' },
    { name: 'Luz de Luna Llena', prompt: 'Bathe the scene in the cool, silvery light of a full moon, with long, soft shadows.', description: 'Crea una atmósfera nocturna mágica con luz de luna.' },
    { name: 'Luz de Hoguera', prompt: 'Simulate the warm, flickering, and orange glow of a campfire, casting dancing shadows.', description: 'Genera un ambiente cálido y comunitario alrededor del fuego.' },
    { name: 'Destello de Lente', prompt: 'Add a realistic lens flare effect, as if pointing the camera towards a strong light source.', description: 'Añade un destello de luz para un toque cinematográfico y soleado.' },
    { name: 'Iluminación de Escenario', prompt: 'Create the effect of a stage spotlight, highlighting a subject while the background falls into darkness.', description: 'Enfoca toda la atención en un sujeto, como en un escenario.' },
    { name: 'Rayos Crepusculares', prompt: 'Add ethereal rays of light (crepuscular rays) streaming through clouds or trees.', description: 'Crea "rayos de dios" para una atmósfera celestial o mágica.' },
    { name: 'Tormenta Eléctrica', prompt: 'Create a dark, stormy atmosphere with dramatic clouds and the occasional flash of lightning.', description: 'Simula la tensión y el drama de una tormenta eléctrica inminente.' },
    { name: 'Aurora Boreal', prompt: 'Introduce the vibrant, dancing green and purple lights of the Aurora Borealis into the sky.', description: 'Añade las luces del norte a un cielo nocturno.' },
    { name: 'Luz Volumétrica', prompt: 'Enhance the sense of light occupying space, making light beams visible in the air (e.g., in a dusty room or foggy forest).', description: 'Hace que los rayos de luz sean visibles y tangibles.' },
    { name: 'Luz de Mariposa', prompt: 'Apply butterfly lighting to a portrait, creating a small, butterfly-shaped shadow under the nose.', description: 'Iluminación de retrato glamurosa y favorecedora.' },
    { name: 'Luz Dividida (Split)', prompt: 'Apply split lighting to a portrait, where one side of the face is in light and the other is in shadow.', description: 'Crea un look dramático y de alto contraste para retratos.' },
    { name: 'Bajo la Lluvia', prompt: 'Create the atmosphere of a rainy day, with wet surfaces, reflections, and a cool, muted color palette.', description: 'Simula una escena bajo la lluvia, con un ambiente melancólico.' },
    { name: 'Día de Otoño', prompt: 'Evoke a crisp autumn day with warm, low-angle light and long shadows.', description: 'Crea la luz cálida y dorada de una tarde de otoño.' },
    { name: 'Mañana de Invierno', prompt: 'Simulate the cold, bright light of a winter morning, with a slight blue cast and high clarity.', description: 'Luz fría y nítida, perfecta para escenas de nieve.' },
    { name: 'Interior Acogedor', prompt: 'Create a warm and inviting indoor atmosphere with soft, artificial light sources like lamps.', description: 'Genera una sensación de confort y calidez en interiores.' },
    { name: 'Luz de Callejón Oscuro', prompt: 'Create a gritty, urban feel with a single, harsh light source in a dark alley setting.', description: 'Para un ambiente de cine negro o thriller urbano.' },
    { name: 'Bajo el Agua', prompt: 'Simulate an underwater scene with diffused, blue-green light and a sense of depth.', description: 'Crea la sensación de estar bajo el agua, con su luz y color característicos.' },
    { name: 'Exposición Larga (Rastros)', prompt: 'Simulate a long exposure effect, creating light trails from moving sources like cars.', description: 'Añade rastros de luz dinámicos a escenas nocturnas.' },
    { name: 'Filtro de Densidad Neutra', prompt: 'Simulate the effect of a neutral density filter, allowing for a longer exposure to blur motion, like smoothing out waterfalls or clouds.', description: 'Suaviza el movimiento del agua o las nubes.' },
    { name: 'Luz de Taller', prompt: 'Create the practical, focused lighting of a workshop or garage, often from a single overhead source.', description: 'Iluminación funcional y cruda, ideal para escenas industriales.' },
    { name: 'Luz de Galería de Arte', prompt: 'Apply clean, even, and well-placed lighting to make the subject look like an exhibit in an art gallery.', description: 'Iluminación perfecta y cuidada, como en una galería.' },
    { name: 'Filtro Polarizador', prompt: 'Simulate the effect of a polarizing filter, deepening blue skies, reducing reflections, and increasing color saturation.', description: 'Intensifica los cielos azules y reduce los reflejos.' },
    { name: 'Luz Infrarroja', prompt: 'Simulate the look of infrared photography, where foliage becomes white and skies turn dark.', description: 'Crea un paisaje surrealista y de otro mundo.' },
    { name: 'Ambiente de Invernadero', prompt: 'Create a bright, humid atmosphere with diffused light filtering through glass and surrounded by lush plants.', description: 'Luz suave y difusa en un entorno lleno de vegetación.' },
    { name: 'Luz de Gas', prompt: 'Recreate the soft, eerie, greenish-yellow glow of old gas lamps.', description: 'Para un look vintage y misterioso de la era victoriana.' },
    { name: 'Estilo "Blade Runner"', prompt: 'Evoke the "Blade Runner" aesthetic with high contrast, deep shadows, and shafts of light cutting through a hazy, futuristic urban environment.', description: 'Atmósfera ciberpunk con luces de neón y humo.' },
    { name: 'Luz de Laboratorio', prompt: 'Apply a sterile, even, and often cool-toned lighting found in scientific or medical labs.', description: 'Iluminación limpia, funcional y a menudo fría.' },
    { name: 'Fuegos Artificiales', prompt: 'Add the bright, colorful bursts of fireworks to the sky, illuminating the scene from above.', description: 'Añade una celebración de fuegos artificiales al cielo.' },
    { name: 'Luz de Vitral', prompt: 'Cast colorful, patterned light onto the scene, as if it were passing through a stained-glass window.', description: 'Proyecta patrones de luz coloreada sobre el sujeto.' },
    { name: 'Modo Crepúsculo', prompt: 'Capture the magical moment of twilight, balancing the last light of the sun with the emerging artificial lights of a city.', description: 'El balance perfecto entre la luz natural y la artificial al anochecer.' },
    { name: 'Efecto Bokeh', prompt: 'Enhance or create soft, pleasing out-of-focus light orbs in the background.', description: 'Crea o mejora las luces desenfocadas del fondo.' },
    { name: 'Luz de Interrogación', prompt: 'Create a harsh, single overhead light source in a dark room, creating a dramatic and suspenseful mood.', description: 'Iluminación de alto drama y suspense.' },
    { name: 'Polvo en el Aire', prompt: 'Add visible particles of dust or glitter in the air, caught in beams of light, to add texture and atmosphere.', description: 'Añade partículas flotantes para dar textura al aire.' },
  ],
  'Color y Tono': [
    { name: 'HDR Vibrante', prompt: 'Apply a subtle high-dynamic-range (HDR) effect to bring out details in both the highlights and shadows, making the image more vibrant and detailed.', description: 'Realza los detalles en toda la imagen, haciendo los colores más vivos.' },
    { name: 'Blanco y Negro Clásico', prompt: 'Convert the image to a classic, high-contrast black and white with rich blacks and bright whites.', description: 'Un look atemporal y dramático para cualquier tipo de foto.' },
    { name: 'Tonos Sepia', prompt: 'Give the image a nostalgic, warm sepia tone for a vintage, old-photograph look.', description: 'Perfecto para dar un toque antiguo y sentimental.' },
    { name: 'Colores Vívidos', prompt: 'Boost the overall color saturation and vibrance to make the colors pop without looking unnatural.', description: 'Ideal para fotos de viajes o naturaleza que necesitan más vida.' },
    { name: 'Tonos Pastel', prompt: 'Desaturate the colors and shift them towards soft, dreamy pastel shades.', description: 'Crea una estética suave, ideal para moda, recién nacidos o bodas.' },
    { name: 'Efecto "Cross-Process"', prompt: 'Simulate a cross-processing film effect with shifted colors, high contrast, and unusual tones.', description: 'Un look experimental con colores únicos, ideal para fotos urbanas o de moda.' },
    { name: 'Paleta "Teal & Orange"', prompt: 'Apply the popular cinematic "teal and orange" color grade, pushing shadows towards teal and highlights/skin tones towards orange.', description: 'Consigue el look de las películas de Hollywood al instante.' },
    { name: 'Colores Apagados', prompt: 'Create a moody, desaturated look by muting the colors and slightly crushing the blacks.', description: 'Para una atmósfera melancólica y cinematográfica.' },
    { name: 'Balance de Blancos Frío', prompt: 'Shift the overall color balance towards cooler, blue tones for a crisp or somber feel.', description: 'Útil para escenas de invierno o para transmitir una sensación de calma o soledad.' },
    { name: 'Balance de Blancos Cálido', prompt: 'Shift the overall color balance towards warmer, yellow/orange tones for a cozy or nostalgic feel.', description: 'Acentúa la calidez de un atardecer o un interior acogedor.' },
    { name: 'Look "Bleach Bypass"', prompt: 'Simulate the "bleach bypass" film processing technique for a high-contrast, desaturated, and gritty look.', description: 'Un look crudo y de alto contraste, popular en películas de acción.' },
    { name: 'Monocromático (un solo color)', prompt: 'Convert the image to a monochromatic scheme based on a single color (e.g., all blues, all reds), preserving luminance.', description: 'Tiñe la imagen con un solo color para un efecto artístico.' },
    { name: 'Kodachrome 60s', prompt: 'Emulate the iconic look of Kodachrome film from the 60s with rich, vibrant, and slightly oversaturated colors.', description: 'Colores vivos y nostálgicos que recuerdan a las diapositivas antiguas.' },
    { name: 'Ektachrome Vívido', prompt: 'Simulate the look of Kodak Ektachrome film, known for its fine grain and vibrant, realistic colors.', description: 'Colores intensos y realistas, como en las revistas de los 80 y 90.' },
    { name: 'Fuji Velvia', prompt: 'Recreate the look of Fujifilm Velvia, a slide film famous for its extremely high color saturation, especially in reds and greens.', description: 'Saturación ultra alta, ideal para paisajes espectaculares.' },
    { name: 'Tono Dividido (Split Toning)', prompt: 'Apply a split tone effect, adding one color to the shadows (e.g., blue) and a different color to the highlights (e.g., yellow).', description: 'Colorea las luces y las sombras de forma diferente para un look estilizado.' },
    { name: 'Reducir Neblina', prompt: 'Intelligently cut through atmospheric haze or fog to increase contrast and color saturation, clarifying distant details.', description: 'Mejora la claridad y el contraste en fotos con neblina.' },
    { name: 'Negros Aplastados (Matte)', prompt: 'Create a modern matte look by raising the black point, so the darkest parts of the image are a dark gray instead of pure black.', description: 'Un look mate y moderno sin negros puros.' },
    { name: 'Alto Contraste Tonal', prompt: 'Dramatically increase the contrast in the midtones while protecting the highlights and shadows from clipping.', description: 'Añade "punch" y dramatismo a la imagen sin perder detalle.' },
    { name: 'Invertir Colores (Negativo)', prompt: 'Invert all the colors in the image to create a color negative effect.', description: 'Crea un efecto psicodélico invirtiendo todos los colores.' },
    { name: 'Aislamiento de Color', prompt: 'Make the entire image black and white except for a single chosen color (e.g., red), which remains saturated.', description: 'Destaca un solo color en una imagen en blanco y negro.' },
    { name: 'Paleta de Color Limitada', prompt: 'Reduce the entire image to a limited palette of just 3-4 dominant colors for a graphic, stylized look.', description: 'Simplifica la imagen a unos pocos colores para un efecto gráfico.' },
    { name: 'Tonalidad de Otoño', prompt: 'Shift the color palette to emphasize the warm oranges, reds, and yellows of autumn foliage.', description: 'Realza los colores cálidos del otoño.' },
    { name: 'Tonalidad de Verano', prompt: 'Boost bright, sunny colors like vibrant greens, sky blues, and warm yellows.', description: 'Colores vivos y alegres que evocan el verano.' },
    { name: 'Tonalidad de Invierno', prompt: 'Create a cool, crisp color palette with an emphasis on blues, whites, and muted tones.', description: 'Tonos fríos y nítidos para una atmósfera invernal.' },
    { name: 'Efecto Infrarrojo (Color)', prompt: 'Simulate false-color infrared photography, turning greens to red or pink and skies to deep blue.', description: 'Un look surrealista que transforma los colores de la naturaleza.' },
    { name: 'Cianotipia', prompt: 'Transform the image into a cyanotype print with its characteristic monochrome cyan-blue palette.', description: 'Un look vintage en tonos de azul cian.' },
    { name: 'Tono Dorado', prompt: 'Apply a rich, golden tone to the entire image, enhancing warmth and creating a luxurious feel.', description: 'Baña la imagen en un lujoso tono dorado.' },
    { name: 'Tono Platino', prompt: 'Give the image a subtle, cool platinum or palladium tone for a sophisticated, archival look.', description: 'Un acabado elegante con tonos grises fríos.' },
    { name: 'Acento en Rojos', prompt: 'Increase the saturation and vibrancy of only the red tones in the image.', description: 'Hace que los rojos de la imagen resalten.' },
    { name: 'Acento en Verdes', prompt: 'Increase the saturation and vibrancy of only the green tones in the image.', description: 'Hace que los verdes de la imagen resalten.' },
    { name: 'Acento en Azules', prompt: 'Increase the saturation and vibrancy of only the blue tones in the image.', description: 'Hace que los azules de la imagen resalten.' },
    { name: 'Desaturación Selectiva', prompt: 'Slightly desaturate all colors except for skin tones, making people stand out.', description: 'Apaga los colores del fondo para que las personas destaquen.' },
    { name: 'Armonía de Color Análoga', prompt: 'Shift the colors in the image to fit an analogous color scheme (colors that are next to each other on the color wheel).', description: 'Crea una paleta de colores suave y armoniosa.' },
    { name: 'Armonía de Color Complementaria', prompt: 'Increase the contrast and vibrancy between complementary colors (opposites on the color wheel, like red/green or blue/orange).', description: 'Aumenta el impacto visual acentuando colores opuestos.' },
    { name: 'Tinte Verde "Matrix"', prompt: 'Apply a monochromatic green tint and slightly increase contrast for a "Matrix"-style digital look.', description: 'El clásico look de código verde de "Matrix".' },
    { name: 'Tinte Magenta Urbano', prompt: 'Add a magenta or purple tint, especially to the shadows, for a modern, urban nightlife look.', description: 'Tonos magenta para una estética urbana y nocturna.' },
    { name: 'Ecualización de Tono de Piel', prompt: 'Analyze and even out skin tones across a portrait or group photo, reducing patchiness or color casts.', description: 'Unifica y corrige los tonos de piel para un look más consistente.' },
    { name: 'Reducción de Dominante de Color', prompt: 'Intelligently identify and neutralize an unwanted color cast (e.g., from artificial lighting) to restore natural colors.', description: 'Elimina tintes de color no deseados para restaurar colores naturales.' },
    { name: 'Efecto "Day for Night"', prompt: 'Simulate a night scene from a daytime photo by reducing exposure, increasing contrast, and adding a strong blue color cast.', description: 'Convierte una foto de día en una escena nocturna creíble.' },
    { name: 'Técnica "Amelie"', prompt: 'Recreate the distinct color palette of the film "Amelie" with an emphasis on saturated reds, greens, and warm golden tones.', description: 'El look mágico y saturado de la película "Amelie".' },
    { name: 'Técnica "Sin City"', prompt: 'Create a high-contrast black and white image with selective, vibrant splashes of a single color (usually red, yellow, or blue).', description: 'Estilo de cómic noir con color selectivo.' },
    { name: 'Solarización', prompt: 'Simulate the Sabattier effect (solarization), where the image tones are partially reversed, creating a mix of positive and negative areas.', description: 'Un efecto de cuarto oscuro que invierte parcialmente la imagen.' },
    { name: 'Aumento de Rango Dinámico', prompt: 'Expand the tonal range of the image, recovering details from deep shadows and bright highlights without creating a typical HDR look.', description: 'Recupera información en las zonas más oscuras y más claras.' },
    { name: 'Corrección de Color Submarino', prompt: 'Restore natural colors to an underwater photo by reintroducing reds and yellows that are lost at depth.', description: 'Devuelve los colores reales a las fotos tomadas bajo el agua.' },
    { name: 'Paleta Neón', prompt: 'Shift the color palette towards vibrant, electric neon colors like pink, cyan, and lime green.', description: 'Transforma los colores de la imagen en tonos de neón brillantes.' },
    { name: 'Colores de Caramelo', prompt: 'Boost saturation and brightness to create a candy-colored, hyper-real look.', description: 'Colores súper saturados y brillantes, como de una tienda de dulces.' },
    { name: 'Tono Metálico', prompt: 'Give the image a metallic sheen by increasing contrast, desaturating colors, and adding a cool, silver or steel-blue tint.', description: 'Crea un acabado frío y metálico.' },
    { name: 'Look "Wes Anderson"', prompt: 'Apply a perfectly symmetrical, flat color palette with an emphasis on pastel yellows, pinks, and blues.', description: 'El icónico estilo visual simétrico y de colores pastel de Wes Anderson.' },
    { name: 'Tono Terroso', prompt: 'Shift the palette to earthy tones: browns, muted greens, terracotta, and ochre, for a natural, grounded feel.', description: 'Crea una paleta de colores natural y orgánica.' },
  ],
  'Retrato': [
    { name: 'Desenfoque de Fondo', prompt: 'Apply a realistic depth-of-field effect, making the background blurry (bokeh) while keeping the main subject in sharp focus.', description: 'Ideal para retratos, aísla al sujeto del fondo.' },
    { name: 'Suavizar Piel', prompt: 'Apply subtle, natural-looking skin smoothing to reduce blemishes and wrinkles while retaining skin texture.', description: 'Mejora la piel en retratos de forma realista sin perder detalle.' },
    { name: 'Ojos Penetrantes', prompt: 'Slightly enhance the sharpness, brightness, and color of the eyes to make them stand out.', description: 'Aporta vida y enfoque a la mirada en los retratos.' },
    { name: 'Luz de Relleno', prompt: 'Add a soft, flattering fill light to gently reduce harsh shadows on the face.', description: 'Simula el uso de un reflector para una iluminación facial más suave.' },
    { name: 'Contorno Facial', prompt: 'Enhance the natural facial contours by subtly dodging and burning to add depth and dimension.', description: 'Añade profundidad y definición a los rasgos faciales.' },
    { name: 'Blanquear Dientes', prompt: 'Naturally whiten and brighten teeth without making them look artificial.', description: 'Mejora las sonrisas de forma sutil y natural.' },
    { name: 'Retrato de Alta Clave', prompt: 'Create a high-key portrait effect with bright, airy lighting, minimal shadows, and a clean background.', description: 'Un look luminoso y optimista, común en fotografía de belleza.' },
    { name: 'Retrato de Baja Clave', prompt: 'Create a low-key portrait effect with dark tones, deep shadows, and dramatic lighting that carves the subject out of the darkness.', description: 'Un estilo dramático e intenso que resalta la forma y el carácter.' },
    { name: 'Separación de Frecuencias', prompt: 'Apply an advanced frequency separation technique to smooth skin tone and color without losing texture detail.', description: 'Técnica profesional para una piel perfecta pero natural.' },
    { name: 'Luz de Atrapa (Catchlight)', prompt: 'Add a natural-looking catchlight (reflection of a light source) to the eyes to make them look more alive.', description: 'Añade un brillo en los ojos para darles más vida.' },
    { name: 'Reducir Brillos en la Piel', prompt: 'Subtly reduce oily or specular highlights on the skin for a more matte, even finish.', description: 'Elimina los brillos no deseados de la piel grasa.' },
    { name: 'Realzar Textura del Pelo', prompt: 'Increase the sharpness and contrast in the hair to bring out individual strands and texture.', description: 'Añade definición y detalle al cabello.' },
    { name: 'Corregir Lentes', prompt: 'Reduce or remove glare and reflections from eyeglasses.', description: 'Disminuye los reflejos molestos en las gafas.' },
    { name: 'Mejorar Color de Labios', prompt: 'Slightly boost the natural color and saturation of the lips.', description: 'Añade un toque de color natural a los labios.' },
    { name: 'Reducir Ojeras', prompt: 'Gently lighten the area under the eyes to reduce the appearance of dark circles.', description: 'Disminuye la apariencia de cansancio bajo los ojos.' },
    { name: 'Añadir Bronceado Sutil', prompt: 'Give the skin a subtle, healthy, sun-kissed tan.', description: 'Añade un ligero y saludable tono bronceado a la piel.' },
    { name: 'Retrato Corporativo', prompt: 'Create a clean, professional look suitable for a corporate headshot, with even lighting and a neutral background.', description: 'Un look pulido y profesional para fotos de perfil de negocios.' },
    { name: 'Estilo "Film Noir"', prompt: 'Apply dramatic, high-contrast black and white lighting suitable for a moody "film noir" portrait.', description: 'Retrato en blanco y negro con el misterio del cine negro.' },
    { name: 'Retrato de Belleza', prompt: 'Create a flawless beauty-shot look with perfect skin, bright eyes, and soft, glamorous lighting.', description: 'El look perfecto de una editorial de belleza.' },
    { name: 'Tono de Piel Dorado', prompt: 'Enhance skin tones with a warm, golden hue for a healthy and vibrant look.', description: 'Añade calidez y un brillo dorado a la piel.' },
    { name: 'Tono de Piel Frío', prompt: 'Cool down skin tones for a more porcelain or high-fashion look.', description: 'Enfría los tonos de piel para una estética de alta moda.' },
    { name: 'Efecto "Peter Hurley"', prompt: 'Recreate the signature headshot style of Peter Hurley with a sharp focus, defined jawline, and engaging expression.', description: 'Emula el estilo de los retratos de un fotógrafo de renombre.' },
    { name: 'Luz de Borde (Rim Light)', prompt: 'Add a "rim light" or "kicker" that outlines the subject and separates them from the background.', description: 'Añade una luz de contorno para separar al sujeto del fondo.' },
    { name: 'Retrato Ambiental', prompt: 'Enhance the connection between the subject and their environment, ensuring both are well-lit and in harmony.', description: 'Integra al sujeto en su entorno de forma natural.' },
    { name: 'Foto de Grupo (Enfoque)', prompt: 'Ensure all faces in a group photo are in focus and well-lit, using techniques like focus stacking if necessary.', description: 'Mejora la nitidez y la iluminación en todas las caras de una foto de grupo.' },
    { name: 'Retrato Cándido', prompt: 'Enhance the natural, unposed feel of a candid shot by preserving natural light and not over-retouching.', description: 'Mejora una foto espontánea sin que parezca posada.' },
    { name: 'Retrato de Silueta', prompt: 'Create a perfect silhouette portrait, ensuring the subject\'s outline is crisp against a bright background.', description: 'Define perfectamente la silueta de una persona.' },
    { name: 'Afinar Rasgos Faciales', prompt: 'Subtly and realistically refine facial features, such as slimming the jawline or straightening the nose, based on principles of proportion.', description: 'Realiza ajustes muy sutiles para armonizar los rasgos.' },
    { name: 'Reducir Enrojecimiento de Piel', prompt: 'Neutralize and reduce red or blotchy patches on the skin for a more even complexion.', description: 'Corrige rojeces e imperfecciones en el tono de la piel.' },
    { name: 'Añadir Pecas', prompt: 'Add subtle, natural-looking freckles to the face.', description: 'Añade pecas realistas al rostro.' },
    { name: 'Mejorar Barba', prompt: 'Enhance the texture, fill in sparse areas, and define the shape of a beard or stubble.', description: 'Define y mejora la apariencia de la barba.' },
    { name: 'Maquillaje Digital Sutil', prompt: 'Apply subtle digital makeup, such as a hint of eyeshadow, eyeliner, or blush, in a natural style.', description: 'Añade un toque de maquillaje digital muy natural.' },
    { name: 'Enfatizar Estructura Ósea', prompt: 'Use dodging and burning to emphasize the cheekbones and jawline.', description: 'Define los pómulos y la mandíbula.' },
    { name: 'Realzar Color de Ojos', prompt: 'Slightly boost the natural color and saturation of the irises.', description: 'Añade un toque de color a los ojos.'},
    { name: 'Efecto "Vogue"', prompt: 'Recreate the high-fashion, sharp, and often dramatic look of a Vogue magazine cover.', description: 'El look de una portada de revista de alta moda.'},
    { name: 'Retrato al Óleo', prompt: 'Give the portrait the look of a classical oil painting.', description: 'Transforma un retrato en una pintura al óleo clásica.'},
    { name: 'Iluminación Clamshell', prompt: 'Apply clamshell lighting, a popular beauty setup with two lights in front of the subject, one above and one below.', description: 'Iluminación de belleza que crea un look muy favorecedor.'},
    { name: 'Retrato de Maternidad', prompt: 'Create a soft, glowing, and intimate look suitable for maternity photos.', description: 'Un look suave y tierno para fotos de embarazo.'},
    { name: 'Retrato de Recién Nacido', prompt: 'Apply a very soft, dreamy, and high-key look, with pastel colors, perfect for newborn photography.', description: 'Estilo suave y delicado para fotos de recién nacidos.'},
    { name: 'Efecto "Annie Leibovitz"', prompt: 'Emulate the dramatic, often conceptual, and painterly style of portraits by Annie Leibovitz.', description: 'Un estilo de retrato dramático y conceptual.'},
    { name: 'Retrato de Pareja', prompt: 'Enhance the connection and intimacy in a photo of a couple with warm tones and soft lighting.', description: 'Mejora la calidez y la conexión en fotos de pareja.'},
    { name: 'Retrato Familiar', prompt: 'Ensure all members of a family portrait are well-lit and in focus, with harmonious skin tones.', description: 'Mejora la iluminación y el color en retratos de familia.'},
    { name: 'Retrato de Mascota', prompt: 'Enhance the texture of the fur and add a catchlight to the eyes of a pet portrait.', description: 'Mejora los detalles y la mirada en retratos de mascotas.'},
    { name: 'Sonrisa Radiante', prompt: 'Enhance a smile by not only whitening teeth but also slightly brightening the eyes and adding warmth to the skin.', description: 'Haz que una sonrisa sea el centro de atención.'},
    { name: 'Mirada Intensa', prompt: 'Create a very dramatic and intense look by darkening the surroundings and focusing all the light and sharpness on the eyes and face.', description: 'Un retrato de gran intensidad dramática centrado en la mirada.'},
    { name: 'Retrato de Perfil', prompt: 'Enhance a profile shot by using light and shadow to sculpt the facial features.', description: 'Define los rasgos en una foto de perfil.'},
    { name: 'Retrato de Corpo Inteiro', prompt: 'Ensure the subject is well-lit from head to toe and stands out from the background in a full-body portrait.', description: 'Mejora la iluminación y el enfoque en retratos de cuerpo entero.'},
    { name: 'Retrato Deportivo', prompt: 'Create a gritty, high-contrast, and dynamic look suitable for an athlete\'s portrait.', description: 'Un look de alta energía para retratos de deportistas.'},
    { name: 'Retrato Boudoir', prompt: 'Apply a soft, sensual, and intimate lighting and color style suitable for boudoir photography.', description: 'Un estilo suave e íntimo para fotografía boudoir.'},
  ],
  'Detalle y Textura': [
      { name: 'Nitidez Inteligente', prompt: 'Apply intelligent sharpening to the image, enhancing details only where needed (like edges) without introducing halos or artifacts.', description: 'Mejora la nitidez de forma profesional sin crear artefactos.' },
      { name: 'Claridad y Contraste', prompt: 'Increase midtone contrast to add "punch" and dimension to the image, making details pop.', description: 'Añade profundidad y fuerza a la imagen.' },
      { name: 'Reducción de Ruido', prompt: 'Intelligently reduce digital noise and grain from high-ISO or low-light photos while preserving important details.', description: 'Limpia el ruido de las fotos oscuras sin perder detalle.' },
      { name: 'Añadir Grano de Película', prompt: 'Add a realistic film grain to the image for a classic, textured, analog look.', description: 'Simula el grano de la película fotográfica para un look clásico.' },
      { name: 'Textura Suave (Orton)', prompt: 'Apply a subtle Orton effect, which combines a sharp and a blurry version of the image to create a soft, dreamy, and glowing look.', description: 'Crea un efecto de ensueño y resplandor.' },
      { name: 'Mejorar Microcontraste', prompt: 'Enhance local contrast to bring out fine textures in surfaces like rock, fabric, or wood.', description: 'Realza las texturas más finas en cualquier superficie.' },
      { name: 'Enfoque Suave', prompt: 'Apply a soft focus filter for a flattering, ethereal, and romantic look, especially for portraits.', description: 'Un desenfoque suave y favorecedor para un look romántico.' },
      { name: 'Efecto de Enfoque Apilado', prompt: 'Simulate the effect of focus stacking, ensuring that the entire image from foreground to background is tack sharp.', description: 'Consigue una nitidez perfecta en toda la profundidad de la imagen.' },
      { name: 'Eliminar Aberración Cromática', prompt: 'Automatically detect and remove chromatic aberration (color fringing) from the edges of high-contrast objects.', description: 'Corrige los halos de color que aparecen en los bordes.' },
      { name: 'Corrección de Distorsión de Lente', prompt: 'Correct for barrel or pincushion distortion typically caused by wide-angle or telephoto lenses.', description: 'Endereza las líneas curvas causadas por la lente de la cámara.' },
      { name: 'Efecto "Dave Hill"', prompt: 'Recreate the "Dave Hill" look, which is a hyper-realistic, high-clarity, and often HDR style popular in commercial photography.', description: 'Un look hiperrealista y muy detallado.' },
      { name: 'Alto Rango Dinámico (HDR)', prompt: 'Apply a High Dynamic Range effect to reveal details in both the darkest shadows and brightest highlights.', description: 'Muestra todos los detalles en las zonas de luz y sombra.' },
      { name: 'Efecto "Dragan"', prompt: 'Emulate the "Dragan" effect, a style of portraiture with extreme detail, texture, and dramatic, gritty toning.', description: 'Retratos con un nivel de detalle y dramatismo extremos.' },
      { name: 'Texturizar Superficies', prompt: 'Add a subtle texture overlay (like canvas, paper, or grunge) to the entire image.', description: 'Añade una capa de textura a la imagen.' },
      { name: 'Viñeta Natural', prompt: 'Add a subtle, natural-looking vignette to darken the corners of the image and draw attention to the center.', description: 'Oscurece las esquinas para centrar la atención.' },
      { name: 'Viñeta Blanca', prompt: 'Add a white vignette to lighten the corners for a high-key or dreamy effect.', description: 'Aclara las esquinas para un look etéreo.' },
      { name: 'Efecto de "Pintura Húmeda"', prompt: 'Give the image the appearance of a wet oil painting, with shimmering highlights and slightly blended details.', description: 'Haz que la foto parezca una pintura al óleo fresca.' },
      { name: 'Textura de Metal Cepillado', prompt: 'Apply a brushed metal texture over the image.', description: 'Añade una textura de metal cepillado.' },
      { name: 'Textura de Cuero', prompt: 'Apply a leather texture over the image.', description: 'Añade una textura de cuero.' },
      { name: 'Textura de Papel Arrugado', prompt: 'Make the image look like it was printed on a crumpled piece of paper.', description: 'Simula que la foto está impresa en papel arrugado.' },
      { name: 'Realce de Reflejos', prompt: 'Specifically enhance and sharpen reflections in water or glass.', description: 'Mejora la nitidez de los reflejos.' },
      { name: 'Nitidez de Bordes', prompt: 'Apply sharpening only to the edges of objects, leaving flat surfaces untouched.', description: 'Afila solo los contornos de los objetos.' },
      { name: 'Suavizado de Fondos', prompt: 'Apply noise reduction and subtle blurring only to the out-of-focus background areas.', description: 'Limpia y suaviza solo el fondo de la imagen.' },
      { name: 'Efecto "Glamour Glow"', prompt: 'Apply a soft, glowing diffusion filter, popular in classic Hollywood glamour shots.', description: 'Un brillo suave y favorecedor al estilo del Hollywood clásico.' },
      { name: 'Reducción de Moaré', prompt: 'Remove moiré patterns that can appear on detailed, repeating textures like fabrics.', description: 'Elimina los patrones de interferencia en los tejidos.' },
      { name: 'Restauración de Fotos Antiguas', prompt: 'Intelligently remove scratches, dust, and creases from a scanned old photograph.', description: 'Limpia y restaura fotos antiguas dañadas.' },
      { name: 'Mejorar Textura de la Ropa', prompt: 'Increase the microcontrast and sharpness specifically in clothing to bring out the texture of the fabric.', description: 'Realza la textura de los tejidos en la ropa.' },
      { name: 'Nitidez para Redes Sociales', prompt: 'Apply the optimal level of sharpening for displaying images on web and social media platforms.', description: 'Aplica la nitidez perfecta para ver la foto en pantallas.' },
      { name: 'Efecto "Plástico"', prompt: 'Give surfaces a smooth, shiny, plastic-like appearance.', description: 'Haz que las superficies parezcan de plástico brillante.' },
      { name: 'Efecto "Porcelana"', prompt: 'Create a porcelain-like finish, especially on skin, with a smooth, flawless, and slightly glowing texture.', description: 'Un acabado de piel suave y perfecto como la porcelana.' },
      { name: 'Detalle Arquitectónico', prompt: 'Enhance the fine details, lines, and textures in architectural photography.', description: 'Realza los detalles en fotos de edificios.' },
      { name: 'Textura de Comida', prompt: 'Make food look more appetizing by enhancing texture, moisture, and color.', description: 'Mejora la textura para que la comida parezca más apetitosa.' },
      { name: 'Efecto "Fresco Seco"', prompt: 'Give the image the dry, matte, and slightly cracked texture of an ancient fresco painting.', description: 'Simula la textura de una pintura al fresco antigua.' },
      { name: 'Líneas de Contorno', prompt: 'Extract the main contours of the image and render them as lines, like a coloring book page.', description: 'Convierte la foto en un dibujo de líneas.' },
      { name: 'Eliminar Halos', prompt: 'Reduce or remove the bright outlines (halos) around objects that can result from over-sharpening.', description: 'Corrige los halos producidos por un exceso de nitidez.' },
      { name: 'Textura de Lona', prompt: 'Apply a canvas texture to make the image look like it was painted on canvas.', description: 'Añade una textura de lienzo de pintura.' },
      { name: 'Efecto "Cincelado"', prompt: 'Give objects a 3D, chiseled look by enhancing edge highlights and shadows.', description: 'Haz que los objetos parezcan tallados o cincelados.' },
      { name: 'Textura de Arena', prompt: 'Apply a fine, sandy texture to the image.', description: 'Añade una textura de arena fina.' },
      { name: 'Gotas de Lluvia', prompt: 'Add realistic raindrops on the "lens" of the camera.', description: 'Añade gotas de lluvia en la lente.' },
      { name: 'Efecto "Vidrio Esmerilado"', prompt: 'Make the image look like it is being viewed through frosted glass.', description: 'Simula que la foto se ve a través de un cristal esmerilado.' },
      { name: 'Desenfoque de Movimiento', prompt: 'Add a directional motion blur to create a sense of speed or movement.', description: 'Añade un desenfoque de movimiento para dar sensación de velocidad.' },
      { name: 'Desenfoque Radial', prompt: 'Add a radial blur that spins around a central point, creating a zoom or rotation effect.', description: 'Añade un desenfoque circular para un efecto de zoom o giro.' },
      { name: 'Efecto "Fantasma"', prompt: 'Create a ghostly, semi-transparent trail effect from moving objects.', description: 'Crea una estela semitransparente.' },
      { name: 'Subexposición Creativa', prompt: 'Intentionally darken the image to create a moody and underexposed look, while retaining key details.', description: 'Oscurece la imagen para crear un ambiente misterioso.' },
      { name: 'Sobreexposición Creativa', prompt: 'Intentionally brighten the image to create a high-key, blown-out, and ethereal look.', description: 'Aclara la imagen para un look etéreo y luminoso.' },
      { name: 'Mejorar Cielo', prompt: 'Specifically enhance the texture, color, and contrast of the sky and clouds.', description: 'Mejora el color y la textura del cielo.' },
      { name: 'Textura de Agua', prompt: 'Enhance the ripples, waves, and reflections on the surface of water.', description: 'Realza las texturas y reflejos en el agua.' },
      { name: 'Textura de Nieve', prompt: 'Bring out the detail and sparkle in snow.', description: 'Realza la textura y el brillo de la nieve.' },
      { name: 'Efecto "In-Camera Shake"', prompt: 'Simulate a slight camera shake for a candid, immediate feel.', description: 'Simula una ligera vibración de la cámara para un look más espontáneo.' },
  ],
  'Artístico y Creativo': [
      { name: 'Doble Exposición', prompt: 'Combine the main image with a second, complementary image (like a cityscape or a forest) into a seamless and artistic double exposure.', description: 'Fusiona dos imágenes en una sola de forma artística.' },
      { name: 'Glitch Art', prompt: 'Apply digital glitch effects, like pixel sorting, color channel shifting, and datamoshing for a modern, chaotic aesthetic.', description: 'Añade efectos de error digital para un look moderno y caótico.' },
      { name: 'Efecto Caleidoscopio', prompt: 'Transform the image into a symmetrical, repeating kaleidoscopic pattern.', description: 'Crea un patrón simétrico y repetitivo como un caleidoscopio.' },
      { name: 'Estilo "Pixel Art"', prompt: 'Convert the image into retro pixel art, like from an 8-bit or 16-bit video game.', description: 'Convierte la foto en una imagen de videojuego retro.' },
      { name: 'Efecto "Tiny Planet"', prompt: 'Warp the image into a "tiny planet" stereographic projection, where the ground curves into a sphere.', description: 'Curva la foto para que parezca un pequeño planeta.' },
      { name: 'Arte de Líneas (Contorno)', prompt: 'Reduce the image to its essential outlines, creating a clean, minimalist line art drawing.', description: 'Convierte la foto en un dibujo de líneas minimalista.' },
      { name: 'Collage', prompt: 'Reassemble the image as a collage made from various cut-out pieces of itself or other textures.', description: 'Reconstruye la imagen como un collage.' },
      { name: 'Póster Gráfico', prompt: 'Transform the image into a bold, graphic poster with limited colors and strong typography.', description: 'Convierte la foto en un póster de diseño gráfico.' },
      { name: 'Arte ASCII', prompt: 'Convert the image into text-based ASCII art.', description: 'Convierte la foto en un dibujo hecho con caracteres de texto.' },
      { name: 'Efecto de Dispersión', prompt: 'Make the subject appear to be breaking apart or dissolving into tiny particles.', description: 'Haz que el sujeto parezca desintegrarse en partículas.' },
      { name: 'Efecto "Espejo"', prompt: 'Mirror one half of the image to create a perfectly symmetrical composition.', description: 'Crea una simetría perfecta reflejando una mitad de la imagen.' },
      { name: 'Falso 3D Anaglifo', prompt: 'Simulate an old-school anaglyph 3D effect by shifting the red and cyan color channels.', description: 'Simula el efecto de las antiguas gafas 3D (rojo y azul).' },
      { name: 'Poligon Art (Low Poly)', prompt: 'Reconstruct the image using a mesh of geometric polygons for a stylized, modern look.', description: 'Reconstruye la imagen con polígonos geométricos.' },
      { name: 'Efecto "Líquido"', prompt: 'Warp and distort the image as if it were liquid or being viewed through water.', description: 'Deforma la imagen como si fuera líquida.' },
      { name: 'Efecto "Humanismo"', prompt: 'Overlay the image with diagrams, text, and symbols reminiscent of Leonardo da Vinci\'s anatomical or engineering sketches.', description: 'Superpón diagramas y notas al estilo de Da Vinci.' },
      { name: 'Póster de Propaganda', prompt: 'Transform the image into a stylized propaganda poster, often with a limited color palette (red, black, beige) and bold fonts.', description: 'Dale a la foto el estilo de un cartel de propaganda.' },
      { name: 'Mapa del Tesoro', prompt: 'Make the image look like an old, burnt, and weathered treasure map.', description: 'Haz que la foto parezca un mapa del tesoro antiguo.' },
      { name: 'Plano (Blueprint)', prompt: 'Convert the image into a technical blueprint drawing, with white lines on a blue background.', description: 'Convierte la foto en un plano de arquitectura (cianotipo).' },
      { name: 'Visión de Calor', prompt: 'Simulate a thermal vision or heat map effect, converting luminance to a color scale from blue (cold) to red (hot).', description: 'Simula el aspecto de una cámara térmica.' },
      { name: 'Visión Nocturna', prompt: 'Simulate the look of a night vision camera, with a monochromatic green tint and digital noise.', description: 'Simula el aspecto de una cámara de visión nocturna.' },
      { name: 'Punto de Cruz', prompt: 'Transform the image to look like it has been stitched in cross-stitch.', description: 'Haz que la foto parezca un bordado de punto de cruz.' },
      { name: 'Efecto "Matrix"', prompt: 'Create the "Matrix" digital rain effect, with green characters streaming down over the image.', description: 'Añade el efecto de la lluvia de código de "Matrix".' },
      { name: 'Desplazamiento RGB', prompt: 'Slightly separate the Red, Green, and Blue channels of the image for a subtle, modern glitch effect.', description: 'Separa los canales de color para un efecto "glitch" sutil.' },
      { name: 'Efecto "Engrama"', prompt: 'Make the image look like a holographic memory or "engram," with scan lines and a semi-transparent, glowing quality.', description: 'Haz que la foto parezca un recuerdo holográfico.' },
      { name: 'Efecto "Droste"', prompt: 'Create a recursive picture-in-a-picture effect, where the image appears within itself.', description: 'Crea un efecto recursivo, con la imagen apareciendo dentro de sí misma.' },
      { name: 'Bordes Quemados', prompt: 'Simulate the effect of burning the edges of the photographic paper for a dramatic, vintage look.', description: 'Añade un efecto de bordes quemados a la foto.' },
      { name: 'Fotograma de Película', prompt: 'Place the image within a filmstrip border, complete with sprocket holes.', description: 'Enmarca la foto como si fuera un fotograma de película.' },
      { name: 'Mundo de Papel', prompt: 'Recreate the scene as if it were made from folded and cut paper (papercraft).', description: 'Haz que la escena parezca hecha de papel recortado y doblado.' },
      { name: 'Mundo de LEGO', prompt: 'Recreate the scene as if it were built from LEGO bricks.', description: 'Reconstruye la escena con bloques de LEGO.' },
      { name: 'Arte con Hilo', prompt: 'Simulate the look of string art, where the image is formed by threads strung between points.', description: 'Haz que la imagen parezca hecha con hilos tensados.' },
      { name: 'Explosión de Color', prompt: 'Simulate an explosion of colored powder (like at a Holi festival) centered on the subject.', description: 'Crea una explosión de polvos de colores.' },
      { name: 'Aura Etérea', prompt: 'Add a soft, glowing aura of color around the main subject.', description: 'Añade un aura de color suave alrededor del sujeto.' },
      { name: 'Geometría Sagrada', prompt: 'Overlay the image with patterns of sacred geometry, like the Flower of Life or Metatron\'s Cube.', description: 'Superpón patrones de geometría sagrada.' },
      { name: 'Estilo "Art Déco"', prompt: 'Apply the bold, symmetrical, and lavish style of the Art Deco movement from the 1920s.', description: 'Aplica el estilo lujoso y geométrico de los años 20.' },
      { name: 'Estilo "Art Nouveau"', prompt: 'Apply the flowing, organic, and nature-inspired lines of the Art Nouveau style.', description: 'Aplica el estilo orgánico y curvo del Art Nouveau.' },
      { name: 'Estilo "Bauhaus"', prompt: 'Recompose the image using the functional, geometric, and minimalist principles of the Bauhaus school.', description: 'Recompón la imagen con la estética minimalista de la Bauhaus.' },
      { name: 'Pintura Corporal', prompt: 'Simulate the subject being covered in intricate body paint.', description: 'Simula que el sujeto tiene el cuerpo pintado.' },
      { name: 'Efecto "Fantasmal"', prompt: 'Make the subject semi-transparent and ethereal, as if they were a ghost.', description: 'Haz que el sujeto parezca un fantasma semitransparente.' },
      { name: 'Desteñido (Tie-Dye)', prompt: 'Apply a vibrant, swirling tie-dye pattern to the image.', description: 'Aplica un patrón de colores psicodélico.' },
      { name: 'Efecto "Risografía"', prompt: 'Simulate a risograph print, with its characteristic bright, slightly misaligned color layers and halftone texture.', description: 'Simula la estética de una impresión con risografía.' },
      { name: 'Efecto "Scanography"', prompt: 'Simulate the look of an image created by moving objects on a flatbed scanner, with shallow depth of field and motion blur.', description: 'Simula el look de una imagen escaneada.' },
      { name: 'Cámara de Juguete', prompt: 'Emulate the look of a cheap plastic toy camera, with vignetting, light leaks, and color shifts.', description: 'Simula el look de una cámara de plástico barata.' },
      { name: 'Retrato de "Doble Cara"', prompt: 'Create a portrait that shows two different expressions or sides of a person, split down the middle.', description: 'Crea un retrato con dos caras o expresiones.' },
      { name: 'Efecto "Espejo Roto"', prompt: 'Make the image look like it is being viewed through a shattered mirror.', description: 'Simula que la foto se ve a través de un espejo roto.' },
      { name: 'Tatuaje', prompt: 'Transform a design into a realistic-looking tattoo on a person\'s skin.', description: 'Convierte un diseño en un tatuaje realista sobre la piel.' },
      { name: 'Carbón sobre Papel', prompt: 'Simulate a charcoal drawing on textured paper.', description: 'Simula un dibujo al carbón sobre papel texturizado.' },
      { name: 'Arte de Pegatinas', prompt: 'Turn the subject into a die-cut sticker with a white border.', description: 'Convierte el sujeto en una pegatina.' },
      { name: 'Estarcido (Stencil)', prompt: 'Convert the image into a high-contrast stencil, like one used for graffiti.', description: 'Convierte la foto en una plantilla de estarcido.' },
      { name: 'Papiro Egipcio', prompt: 'Redraw the image in the style of an ancient Egyptian papyrus painting.', description: 'Dibuja la imagen al estilo del antiguo Egipto.' },
  ]
};

const categoryTooltips: Record<AdjustmentCategory, string> = {
    'Iluminación y Atmósfera': 'Ajustes de luz, sombras y ambiente general.',
    'Color y Tono': 'Ajustes de color, saturación, contraste y balance de blancos.',
    'Retrato': 'Ajustes especializados para mejorar retratos.',
    'Detalle y Textura': 'Ajustes para mejorar la nitidez y los detalles finos.',
    'Artístico y Creativo': 'Efectos especiales y ajustes estilísticos.',
};

export const AdjustmentPanel: React.FC<AdjustmentPanelProps> = ({ onApplyAdjustment, isLoading, currentImage, isPhotoshootMode, selectionCount }) => {
  const [selectedPresets, setSelectedPresets] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [activeCategory, setActiveCategory] = useState<AdjustmentCategory>('Iluminación y Atmósfera');
  const [colorBalance, setColorBalance] = useState({ r: 0, g: 0, b: 0 });

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recommendations, setRecommendations] = useState<AIRecommendation[] | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisContext, setAnalysisContext] = useState('');
  
  const getActivePrompts = useMemo(() => {
    const activePrompts = [...selectedPresets];
    if (customPrompt.trim()) {
      activePrompts.push(customPrompt);
    }
    const { r, g, b } = colorBalance;
    if (r !== 0 || g !== 0 || b !== 0) {
      const balanceStrings = [];
      if (r !== 0) balanceStrings.push(`${r > 0 ? 'increase' : 'decrease'} red tones by ${Math.abs(r)}%`);
      if (g !== 0) balanceStrings.push(`${g > 0 ? 'increase' : 'decrease'} green tones by ${Math.abs(g)}%`);
      if (b !== 0) balanceStrings.push(`${b > 0 ? 'increase' : 'decrease'} blue tones by ${Math.abs(b)}%`);
      activePrompts.push(`Subtly adjust color balance: ${balanceStrings.join(', ')}.`);
    }
    return activePrompts;
  }, [selectedPresets, customPrompt, colorBalance]);

  const handlePresetClick = (prompt: string) => {
    setSelectedPresets(prev => 
        prev.includes(prompt) 
            ? prev.filter(p => p !== prompt)
            : [...prev, prompt]
    );
  };
  
  const handleApply = () => {
    if (getActivePrompts.length > 0) {
      const combinedPrompt = getActivePrompts.join(', y además ');
      onApplyAdjustment(combinedPrompt);
    }
  };
  
  const handleAnalyzeImage = async () => {
    if (!currentImage || isAnalyzing || isLoading) return;
    setIsAnalyzing(true);
    setAnalysisError(null);
    setRecommendations(null);
    try {
        const allPresets = Object.values(presetsByCategory).flat();
        const results = await getAIRecommendations(currentImage, allPresets, analysisContext);
        setRecommendations(results);

        const colorBalanceRec = results.find(r => r.colorBalance);
        if(colorBalanceRec && colorBalanceRec.colorBalance) {
            setColorBalance(colorBalanceRec.colorBalance);
        }

    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error desconocido';
        setAnalysisError(`La IA no pudo analizar la imagen. ${msg}`);
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleColorBalanceChange = (channel: 'r' | 'g' | 'b', value: number) => {
      setColorBalance(prev => ({...prev, [channel]: value}));
  };

  const resetColorBalance = () => {
    setColorBalance({ r: 0, g: 0, b: 0 });
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
      <h3 className="text-lg font-semibold text-center text-gray-300">Ajustes Profesionales</h3>
      <p className="text-sm text-center text-gray-400 -mt-2">Combina ajustes o deja que la IA te recomiende los mejores.</p>
      
      <div className="w-full bg-gray-900/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <SparkleIcon className="w-10 h-10 text-blue-400 flex-shrink-0" />
            <div className="flex-grow">
                <h4 className="font-bold text-gray-100">Asistente de IA para Ajustes</h4>
                <p className="text-sm text-gray-400">Pide a la IA que analice tu foto y te sugiera los ajustes más adecuados.</p>
            </div>
             <button
                onClick={handleAnalyzeImage}
                disabled={isLoading || isAnalyzing || (!currentImage && !isPhotoshootMode)}
                className="w-full sm:w-auto ml-auto flex-shrink-0 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg transition-all duration-200 shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 disabled:bg-blue-800 disabled:cursor-not-allowed disabled:shadow-none"
            >
                {isAnalyzing ? 'Analizando...' : 'Sugerir Ajustes'}
            </button>
        </div>
        <input
            type="text"
            value={analysisContext}
            onChange={(e) => setAnalysisContext(e.target.value)}
            placeholder="Contexto opcional (ej. 'hacerlo más dramático', 'para un perfil profesional')"
            className="w-full bg-gray-800 border border-gray-600 text-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none transition disabled:opacity-60 text-sm"
            disabled={isLoading || isAnalyzing}
            title="Describe el objetivo o el estilo que buscas para obtener mejores recomendaciones."
        />
      </div>
      {analysisError && <p className="text-center text-red-400 text-sm">{analysisError}</p>}
      
      <div className="flex flex-wrap items-center justify-center gap-2 border-b border-gray-700 pb-3">
        {(Object.keys(presetsByCategory) as AdjustmentCategory[]).map(category => (
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
          <p className="text-center font-semibold text-yellow-300 text-sm animate-fade-in">✨ ¡La IA recomienda estos ajustes!</p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-60 overflow-y-auto pr-2">
        {presetsByCategory[activeCategory].map(preset => {
            const recommendation = recommendations?.find(r => r.presetName === preset.name);
            const isRecommended = !!recommendation;
            const isSelected = selectedPresets.includes(preset.prompt);
            return (
              <button
                key={preset.name}
                onClick={() => handlePresetClick(preset.prompt)}
                disabled={isLoading}
                title={isRecommended ? `${preset.description}\n\n✨ IA Recomienda: ${recommendation.reason}` : preset.description}
                className={`relative w-full text-left bg-white/10 border text-gray-200 font-semibold py-2 px-3 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 active:scale-95 text-sm disabled:opacity-50 disabled:cursor-not-allowed ${isSelected ? 'border-blue-500 ring-2 ring-blue-500 bg-blue-500/10' : 'border-transparent hover:border-white/20'} ${isRecommended ? '!border-yellow-400/80 !ring-2 !ring-yellow-400/70 bg-yellow-900/20' : ''}`}
              >
                {isRecommended && <SparkleIcon className="w-3 h-3 absolute top-1.5 right-1.5 text-yellow-300" />}
                {preset.name}
              </button>
            );
        })}
      </div>
        <div className="space-y-3 pt-2">
            <div className="flex justify-between items-center">
                <h4 className="text-sm font-semibold text-gray-300">Balance de Color</h4>
                <button onClick={resetColorBalance} className="text-xs text-gray-400 hover:text-white" title="Reiniciar Balance de Color">Reiniciar</button>
            </div>
            { (['r', 'g', 'b'] as const).map(channel => {
                const colorClass = channel === 'r' ? 'accent-red-500' : channel === 'g' ? 'accent-green-500' : 'accent-blue-500';
                return (
                    <div key={channel} className="flex items-center gap-3">
                        <label className={`w-4 text-center font-bold text-${channel === 'r' ? 'red' : channel === 'g' ? 'green' : 'blue'}-400`}>{channel.toUpperCase()}</label>
                        <input
                            type="range" min="-25" max="25"
                            value={colorBalance[channel]}
                            onChange={(e) => handleColorBalanceChange(channel, parseInt(e.target.value))}
                            className={`w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer ${colorClass}`}
                        />
                        <span className="w-8 text-right text-sm font-mono text-gray-300">{colorBalance[channel]}</span>
                    </div>
                )
            })}
        </div>
      <div className="flex gap-2">
        <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="O describe un ajuste personalizado..."
            className="flex-grow bg-gray-800 border border-gray-600 text-gray-200 rounded-lg p-4 focus:ring-2 focus:ring-blue-500 focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60 text-base"
            disabled={isLoading}
            title="Describe el ajuste que quieres aplicar, por ejemplo: 'Añade un brillo cinematográfico a las luces'."
        />
        <button
            onClick={handleApply}
            className="bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
            disabled={isLoading || getActivePrompts.length === 0 || (isPhotoshootMode && selectionCount === 0)}
            title={isPhotoshootMode && selectionCount === 0 ? "Selecciona una o más imágenes del carrusel para aplicar." : "Aplica los ajustes a la imagen."}
        >
          {getButtonText()}
        </button>
      </div>
    </div>
  );
};