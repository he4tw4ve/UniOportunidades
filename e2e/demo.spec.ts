import { test, expect, type Page } from "@playwright/test";
async function login(page: Page, role: "student" | "admin" | "publisher") {
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
        : role === "admin"
          ? "admin@demo.unioportunidades.test"
          : "publicador3@demo.unioportunidades.test",
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
