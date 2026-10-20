import { test, expect, type Page } from "@playwright/test";
async function login(
  page: Page,
  role: "student" | "admin" | "publisher",
  email?: string,
) {
  await page.goto("/iniciar-sesion");
  if (role !== "student")
    await page
      .getByRole("button", { name: "Organización / Administración" })
      .click();
  await page
    .getByLabel(
      role === "student" ? "Expediente de demostración" : "Correo electrónico",
    )
    .fill(
      role === "student"
        ? "DEMO-001"
        : (email ??
            (role === "admin"
              ? "admin@demo.unioportunidades.test"
              : "publicador3@demo.unioportunidades.test")),
    );
  await page.getByLabel(/^Contraseña/).fill("LocalTestOnly-123!");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}
test("teclado, campos obligatorios y error accesible de credenciales", async ({
  page,
}) => {
  await page.goto("/iniciar-sesion");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Ir al contenido" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  expect(
    await page
      .getByLabel("Expediente de demostración")
      .evaluate((input: HTMLInputElement) => input.validity.valueMissing),
  ).toBe(true);
  await page.getByLabel("Expediente de demostración").fill("DEMO-001");
  await page.getByLabel(/^Contraseña/).fill("ClaveIncorrectaDePrueba");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "No se pudo iniciar sesión con esas credenciales.",
  );
});
test("estudiante: catálogo, contacto, recarga, móvil y cierre de sesión", async ({
  page,
}) => {
  await login(page, "student");
  await expect(page).toHaveURL(/\/ofertas/);
  await expect(
    page.getByRole("button", { name: "Ver todas", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ver todas", exact: true }).click();
  await page.getByRole("article").first().getByRole("link").first().click();
  await expect(page.getByRole("link", { name: /correo/i })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page).toHaveURL(/\/ofertas\//);
  await page.goto("/ofertas");
  await page.setViewportSize({ width: 360, height: 800 });
  await page.getByRole("button", { name: /^Filtros/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.goto("/mi-perfil");
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await expect(page).toHaveURL(/iniciar-sesion/);
  await page.goto("/ofertas");
  await expect(page).toHaveURL(/iniciar-sesion/);
});
test("administrador: indicadores reales y usuarios; publicador conserva panel", async ({
  page,
}) => {
  await login(page, "admin");
  await expect(
    page.getByRole("heading", { name: "Panel de administración" }),
  ).toBeVisible();
  await expect(
    page.getByText("Ofertas publicadas vigentes", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Usuarios", exact: true }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await page.goto("/mi-perfil");
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await login(page, "publisher");
  await expect(page).toHaveURL(/publicador\/panel/);
  await page.goto("/admin/panel");
  await expect(page.getByText(/acceso restringido/i)).toBeVisible();
});
test("flujo principal HTTP: rechazo, reenvío, publicación y edición protegida", async ({
  request,
}) => {
  const base = "http://127.0.0.1:3101/api/v1";
  async function token(email: string) {
    const res = await request.post(base + "/auth/correo/iniciar-sesion", {
      data: { email, password: "LocalTestOnly-123!" },
    });
    expect(res.status()).toBe(200);
    return (await res.json()).data.access_token as string;
  }
  const pub = await token("publicador3@demo.unioportunidades.test"),
    admin = await token("admin@demo.unioportunidades.test");
  async function call(
    method: string,
    path: string,
    actor: string,
    data?: unknown,
    status = 200,
  ) {
    const res = await request.fetch(base + path, {
      method,
      headers: { Authorization: `Bearer ${actor}` },
      data,
    });
    expect(res.status()).toBe(status);
    return (await res.json()).data;
  }
  const content = {
    titulo: "Flujo FICTICIO E2E original",
    descripcion: "Prueba aislada",
    actividades: "Aprendizaje ficticio",
    requisitos: "Interés",
    beneficios: "",
    modalidad: "remote",
    ciudad: "",
    estado_region: "",
    cupos: 2,
    fecha_limite: "2099-12-01",
    duracion_info: "Sin acreditación",
    alcance_carreras: "all",
    carreras: [],
    contacto_nombre: "Responsable ficticio",
    contacto_email: "contacto@example.test",
    contacto_url: "",
    contacto_instrucciones: "Enviar correo externo",
  };
  await call(
    "POST",
    "/publicador/ofertas",
    pub,
    { tipo: "internship", contenido: content },
    403,
  );
  let offer = await call(
    "POST",
    "/publicador/ofertas",
    pub,
    { tipo: "social_service", contenido: content },
    201,
  );
  const id = offer.id;
  const latest = () =>
    offer.revisiones.reduce(
      (a: { numero_version: number }, b: { numero_version: number }) =>
        a.numero_version > b.numero_version ? a : b,
    );
  async function submit() {
    const r = latest();
    offer = await call("POST", `/publicador/revisiones/${r.id}/enviar`, pub, {
      version: r.version,
    });
  }
  async function decide(decision: string) {
    const r = latest();
    offer = await call("POST", `/admin/revisiones/${r.id}/decision`, admin, {
      version: r.version,
      decision,
      comentario: "Motivo ficticio de revisión",
    });
  }
  await submit();
  await decide("rejected");
  expect(latest().estado_revision).toBe("rejected");
  offer = await call(
    "POST",
    `/publicador/ofertas/${id}/nueva-revision`,
    pub,
    { version: offer.version },
    201,
  );
  await submit();
  await decide("approved");
  expect((await call("GET", `/ofertas/${id}`, pub)).titulo).toBe(
    content.titulo,
  );
  offer = await call(
    "POST",
    `/publicador/ofertas/${id}/nueva-revision`,
    pub,
    { version: offer.version },
    201,
  );
  const revision = latest();
  offer = await call("PATCH", `/publicador/revisiones/${revision.id}`, pub, {
    version: revision.version,
    contenido: { ...content, titulo: "Flujo FICTICIO E2E corregido" },
  });
  await submit();
  expect((await call("GET", `/ofertas/${id}`, pub)).titulo).toBe(
    content.titulo,
  );
  await decide("approved");
  expect((await call("GET", `/ofertas/${id}`, pub)).titulo).toBe(
    "Flujo FICTICIO E2E corregido",
  );
  expect(offer.revisiones).toHaveLength(3);
  await call("PATCH", `/publicador/ofertas/${id}/estado`, pub, {
    version: offer.version,
    estado: "closed",
  });
  await call("GET", `/ofertas/${id}`, pub, undefined, 404);
});
test("landing y registro integrados conservan URLs y validaciones", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "aprendizaje",
  );
  await expect(page.getByLabel("Expediente de demostración")).toBeVisible();
  await expect(
    page.getByText(/No hay registro público de estudiantes/),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("landing-desktop.png"),
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Registrar organización", exact: true })
    .click();
  await expect(page).toHaveURL(/registro-organizacion/);
  await expect(page.getByLabel("Contraseña propia")).toBeVisible();
  await page.setViewportSize({ width: 360, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel("Correo electrónico").fill("registro@example.test");
  await page.getByLabel("Contraseña propia").fill("SoloPruebasLocal-123");
  await page
    .getByRole("button", { name: "Crear cuenta de publicador" })
    .click();
  await expect(page.getByRole("status")).toContainText("confirma la cuenta");
  await page.screenshot({
    path: info.outputPath("registro-mobile.png"),
    fullPage: true,
  });
});
test("sidebar por rol, cuenta compacta y navegación móvil", async ({
  page,
}, info) => {
  await login(page, "admin");
  await expect(
    page.getByRole("heading", { name: "Panel de administración" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Organizaciones por revisar" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Oportunidades por revisar" }),
  ).toBeVisible();
  const sidebar = page.getByRole("complementary");
  await expect(
    sidebar.getByRole("link", { name: "Panel de administración", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.screenshot({
    path: info.outputPath("admin-desktop.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Contraer navegación" }).click();
  await expect(
    page.getByRole("button", { name: "Expandir navegación" }),
  ).toBeVisible();
  await sidebar.getByRole("link", { name: "Usuarios", exact: true }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.getByRole("button", { name: "Abrir navegación" }).click();
  const drawer = page.getByRole("dialog", {
    name: "Navegación de UniOportunidades",
  });
  await expect(drawer).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Abrir navegación" }),
  ).toBeFocused();
  await page.setViewportSize({ width: 360, height: 800 });
  await page.getByRole("button", { name: "Abrir navegación" }).click();
  await drawer
    .getByRole("link", { name: "Panel de administración", exact: true })
    .click();
  await expect(drawer).not.toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("admin-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Mi cuenta", exact: true }).click();
  const account = page.getByRole("dialog", { name: "Tu cuenta" });
  await expect(account).toContainText("admin@demo.unioportunidades.test");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Mi cuenta", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Mi cuenta", exact: true }).click();
  await account
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await login(page, "publisher", "publicador2@demo.unioportunidades.test");
  await expect(
    page.getByText(/Aún no puedes crear ni enviar ofertas/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Abrir navegación" }).click();
  await expect(
    drawer.getByRole("link", { name: "Crear oportunidad", exact: true }),
  ).toHaveCount(0);
  await expect(
    drawer.getByRole("link", { name: "Panel de administración", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.goto("/publicador/ofertas/nueva");
  await expect(page.getByRole("alert")).toContainText("debe estar aprobada");
  await expect(page.getByLabel("Título", { exact: true })).toHaveCount(0);
});
test("confirmaciones: cancelar, error, reintento y retorno del foco", async ({
  page,
}, info) => {
  await login(page, "admin");
  const id = "a0000000-0000-4000-8000-000000000104";
  await page.goto(`/admin/ofertas/${id}`);
  const close = page.getByRole("button", {
    name: "Cerrar oportunidad",
    exact: true,
  });
  await close.click();
  const dialog = page.getByRole("dialog", {
    name: "Cerrar oportunidad",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await page.screenshot({ path: info.outputPath("confirmacion.png") });
  await expect(
    dialog.getByRole("button", { name: "Cancelar", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "Confirmar", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(close).toBeFocused();
  let writes = 0;
  await page.route(`**/api/v1/admin/ofertas/${id}/estado`, async (route) => {
    writes++;
    if (writes === 1)
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          data: null,
          error: {
            code: "STALE_OFFER",
            message: "La oportunidad cambió. Actualiza antes de continuar.",
          },
          meta: null,
        }),
      });
    else await route.continue();
  });
  await close.click();
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  expect(writes).toBe(0);
  await close.click();
  await dialog.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "La oportunidad cambió",
  );
  expect(writes).toBe(1);
  await dialog.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(writes).toBe(2);
  await expect(close).toBeDisabled();
  await page
    .getByRole("button", { name: "Reabrir oportunidad", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirmar", exact: true })
    .click();
  await expect(close).toBeEnabled();
});
test("publicador con permiso único crea sin elegir un tipo no autorizado", async ({
  page,
}, info) => {
  await login(page, "publisher", "publicador1@demo.unioportunidades.test");
  await expect(
    page.getByRole("heading", { name: "Panel de organización" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Oportunidades de mi organización" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.screenshot({
    path: info.outputPath("publicador-tablet.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Abrir navegación" }).click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Crear oportunidad", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Nueva oportunidad" }),
  ).toBeVisible();
  await expect(page.getByLabel("Tipo de oportunidad")).toHaveValue(
    "internship",
  );
  await expect(
    page.getByLabel("Tipo de oportunidad").getByRole("option"),
  ).toHaveCount(1);
  await page.goto("/ofertas");
  await expect(page.getByRole("article").first()).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.screenshot({
    path: info.outputPath("catalogo-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 360, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
