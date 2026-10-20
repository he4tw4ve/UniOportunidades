# Módulo reviews

La moderación de Fase 3 se implementa en el router de ofertas y OffersRepository para compartir transacción, bloqueos, validación y aprobación con las correcciones administrativas. No se actualiza silenciosamente contenido aprobado; se registra una única decisión final por revisión y se conserva la publicación anterior al rechazar.
