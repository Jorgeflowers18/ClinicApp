# ClinicApp: configuración del perfil

Esta auditoría documenta la fase visual anterior. El comportamiento funcional vigente —incluidos el menú, la eliminación confirmada, las iniciales sin letras duplicadas y la persistencia entre ingresos— está descrito en [los criterios de aceptación del perfil](profile-acceptance.md).

Rediseño implementado el 14 de noviembre de 2026 tomando como referencia la imagen proporcionada: identidad del usuario en una columna independiente y campos en otra. Se trabajó sobre UserProfilePage, que se utiliza tanto en la configuración inicial como en «Mi perfil».

**Auditoría inicial**

La configuración inicial estaba limitada a 42 rem y concentraba avatar, campos y cinco círculos de color dentro de una sola tarjeta. El avatar medía 48 px y sus iniciales procedían de las dos primeras palabras del nombre, sin tratar correctamente espacios adicionales ni apellidos posteriores.

La pantalla utiliza estado local para el borrador. La carga de fotografías usa el FileReader existente; Continuar/Guardar cambios recorta los espacios exteriores de los campos, conserva el resto del perfil, llama a updateUserProfile y navega al destino anterior. En modo de demostración el store persiste la sesión en sessionStorage. Estos handlers, el store, los servicios, los modelos y los redirects permanecen iguales.

avatarColor se conserva como propiedad del modelo y como dato guardado; la búsqueda de dependencias no encontró consumidores visuales fuera de esta página. Se retiraron los círculos y su callback de selección, manteniendo el valor cargado y el valor por defecto original. El nuevo avatar toma su apariencia de los tokens existentes, sin colores aleatorios.

Cargo y Especialidad son inputs de texto libre. La biografía no tenía un máximo de 250 caracteres y los campos no tenían validaciones obligatorias adicionales. Se mantuvieron estos contratos: no se sustituyeron por desplegables ni se añadieron restricciones sugeridas únicamente por la imagen. El contador muestra caracteres escritos sin introducir un límite.

**Distribución y temas**

- Contenedor centrado de hasta 1000 px. Dos columnas cuando el contenido dispone de al menos 640 px; una columna para espacios menores. La adaptación depende del espacio del componente y funciona también dentro de AppLayout.
- Tarjeta izquierda con avatar circular de 112 px en escritorio y 96 px en celular, nombre, cargo, carga de fotografía y una explicación breve.
- Tarjeta derecha con encabezado, nombre a ancho completo, Cargo/Especialidad en paralelo cuando caben, biografía y acción alineada a la derecha. En celular la acción ocupa el ancho disponible.
- Inter, etiquetas de 13 px, información general de 14 px y jerarquía compacta. Controles táctiles de al menos 44 px en los anchos móviles verificados.
- Superficies claras y acción violeta mediante --primary; Carbon/Obsidian y acción Acid Lime en modo oscuro. El avatar usa el violeta existente y un gradiente estable adecuado a cada tema, separado de los acentos de acción.
- Aviso inferior neutro, con el mismo contenido anterior. El verde continúa reservado para estados de éxito reales.

BrandLogo y el control de cambio de tema se reutilizan. No se modificaron Sidebar, Header, Login, tokens globales, componentes compartidos ni el calendario previamente implementado. Los estilos nuevos están en un CSS Module propio.

**Iniciales y fotografías**

getProfileInitials normaliza el texto para su presentación, elimina espacios exteriores y separa palabras por espacios consecutivos. Usa la primera letra de la primera palabra y de la última, en mayúsculas. Para una sola palabra utiliza sus dos primeras letras; si solo existe una letra, la repite para mantener dos iniciales. Los acentos Unicode se normalizan mediante NFC.

Ejemplos verificados: Fernando Padilla → FP; Ana Morales → AM; Carlos Pérez → CP; María González → MG; José Luis García Pérez → JP; Ana → AN; A → AA. Si el campo está vacío durante la edición, se presenta el nombre existente de la cuenta; el helper tiene US como último respaldo. El nombre guardado no cambia por este cálculo.

Con una imagen se muestra la fotografía. El control pasa de «Subir foto» a «Cambiar foto» y el icono de cámara abre el mismo input de archivo; ambos accesos reutilizan el handler original. La prueba verifica carga, sustitución, guardado y restauración al recargar.

La pantalla original **no tenía una acción para eliminar fotografías**. Para respetar la prohibición de crear acciones nuevas, no se añadió un botón de eliminación. Se verificó que, si el perfil existente vuelve a avatarImage: null, reaparecen automáticamente las iniciales. Esa comprobación utiliza el store existente en un navegador aislado; no representa una acción de eliminación disponible en la interfaz.

**Archivos**

- [user-profile-page.tsx](../front/src/modules/auth/pages/user-profile-page.tsx): distribución y presentación del perfil; conserva estados, handlers y guardado.
- [user-profile-page.module.css](../front/src/modules/auth/pages/user-profile-page.module.css): estilos locales y adaptación por contenedor; nuevo.
- [profile-initials.ts](../front/src/modules/auth/components/profile-initials.ts): cálculo de iniciales exclusivamente para esta pantalla; nuevo.
- [profile-integration.spec.ts](../front/tests/profile-integration.spec.ts): adapta la comprobación del antiguo selector para verificar que un color previamente guardado permanece intacto.
- [profile-setup-visual.spec.ts](../front/tests/profile-setup-visual.spec.ts): pruebas nuevas de iniciales, fotos, temas y adaptación.

**Verificación**

- Build aprobado. Permanece el aviso anterior de bundles mayores de 500 kB.
- Lint aprobado con cinco advertencias preexistentes en componentes ajenos a este cambio.
- 16 casos distintos de Playwright aprobados: nueve de integración existente y siete nuevos. Las dos reejecuciones de carga de fotografías no se cuentan como casos adicionales.
- Comprobados ambos temas en 320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440 y 1920 px, tanto en configuración inicial como en edición. Sin desbordamiento horizontal, campos fuera de pantalla ni pérdida de los valores del borrador.
- Verificados cambios de tema, nombre con espacios y Unicode, nombres de una palabra/letra, biografía de más de 250 caracteres, fotos, guardado, recarga, redirects y permisos de admin, médico y recepción.
- Comparados 246 archivos iniciales: solo cambian dos archivos existentes y se añaden tres de frontend/pruebas. defaultProfile, isInitialSetup, initialProfile, handleChange, handleImageUpload y handleSubmit permanecen idénticos. Los callbacks conservados son iguales; solo se retira el del selector de color.
- Doce instantáneas de estructura/estilos de Login, Sidebar y Header sin diferencias. De 18 capturas de módulos protegidos, 17 son idénticas; Historia clínica oscura presenta una diferencia de un píxel y un nivel de canal. Su código permanece intacto. Las capturas del calendario en ambos temas son idénticas.

**Capturas y evidencia local**

- [Comparación interactiva antes/después](../front/test-results/profile-setup-redesign/comparison.html).
- Escritorio: [claro](../front/test-results/profile-setup-redesign/after/setup-light-1440.png) · [oscuro](../front/test-results/profile-setup-redesign/after/setup-dark-1440.png).
- Tablet: [claro](../front/test-results/profile-setup-redesign/after/setup-light-768.png) · [oscuro](../front/test-results/profile-setup-redesign/after/setup-dark-768.png).
- Celular: [claro](../front/test-results/profile-setup-redesign/after/setup-light-390.png) · [oscuro](../front/test-results/profile-setup-redesign/after/setup-dark-390.png).
- Fotografías: [escritorio claro](../front/test-results/profile-setup-redesign/after/photo-light-1440.png) · [tablet oscura](../front/test-results/profile-setup-redesign/after/photo-dark-768.png) · [celular oscuro](../front/test-results/profile-setup-redesign/after/photo-dark-390.png).
- [Verificación de alcance](../front/test-results/profile-setup-redesign/scope-verification.json) y [resultados de pruebas](../front/test-results/profile-setup-redesign/test-summary.json).

Las capturas se revisaron visualmente en escritorio, tablet y celular, en ambos temas. Las fotografías de prueba se cargaron en contextos de navegador aislados; no sustituyen datos de usuarios en la aplicación. Los artefactos de test-results son locales y están excluidos de Git.

Las verificaciones automatizadas se realizaron con Chrome; no se afirma una matriz de otros navegadores ni una auditoría exhaustiva de lectores de pantalla. Se comprobó la persistencia de demostración existente, sin crear una integración nueva con el backend.

Se conserva main con todos los cambios locales anteriores. No se creó un commit ni se publicó al remoto. El frontend permanece disponible en http://localhost:5173/perfil-usuario.
