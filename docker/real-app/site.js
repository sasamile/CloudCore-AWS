const http = require("http");
const os = require("os");
const PORT = 3000;

const pages = {
  "/": homePage,
  "/about": aboutPage,
  "/services": servicesPage,
  "/contact": contactPage,
};

function layout(title, content, activePath) {
  const nav = [
    { href: "/", label: "Inicio" },
    { href: "/about", label: "Nosotros" },
    { href: "/services", label: "Servicios" },
    { href: "/contact", label: "Contacto" },
  ];
  const navHtml = nav
    .map(
      (n) =>
        `<a href="${n.href}" class="nav-link${activePath === n.href ? " active" : ""}">${n.label}</a>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} - Zyntek Solutions</title>
<style>
:root{--primary:#3b82f6;--primary-dark:#2563eb;--bg:#0a0e1a;--card:#0f1321;--border:#1e293b;--text:#e2e8f0;--muted:#94a3b8;--dark-muted:#64748b;--green:#22c55e;--purple:#a855f7}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg);color:var(--text);line-height:1.6}
a{color:var(--primary);text-decoration:none}
.container{max-width:1100px;margin:0 auto;padding:0 24px}

/* Navbar */
.navbar{background:rgba(15,19,33,.95);border-bottom:1px solid var(--border);padding:16px 0;position:sticky;top:0;z-index:100;backdrop-filter:blur(12px)}
.navbar .container{display:flex;align-items:center;justify-content:space-between}
.nav-brand{font-size:22px;font-weight:800;display:flex;align-items:center;gap:10px;color:var(--text)}
.nav-brand-icon{width:36px;height:36px;background:linear-gradient(135deg,var(--primary),var(--primary-dark));border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:900;color:#fff}
.nav-links{display:flex;gap:8px}
.nav-link{padding:8px 16px;border-radius:8px;color:var(--muted);font-size:14px;font-weight:500;transition:all .2s}
.nav-link:hover,.nav-link.active{color:var(--text);background:rgba(59,130,246,.1)}
.nav-link.active{color:var(--primary)}

/* Hero */
.hero{padding:100px 0 80px;text-align:center}
.hero h1{font-size:52px;font-weight:800;line-height:1.1;margin-bottom:20px;background:linear-gradient(135deg,#fff,var(--primary));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.hero p{font-size:20px;color:var(--muted);max-width:600px;margin:0 auto 36px}
.btn{display:inline-flex;align-items:center;gap:8px;padding:14px 28px;border-radius:12px;font-weight:600;font-size:15px;border:none;cursor:pointer;transition:all .2s}
.btn-primary{background:linear-gradient(135deg,var(--primary),var(--primary-dark));color:#fff;box-shadow:0 4px 20px rgba(59,130,246,.3)}
.btn-primary:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(59,130,246,.4)}
.btn-outline{background:transparent;color:var(--text);border:1px solid var(--border)}
.btn-outline:hover{border-color:var(--primary);color:var(--primary)}
.hero-buttons{display:flex;gap:12px;justify-content:center}

/* Stats Bar */
.stats-bar{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--border);border-radius:16px;overflow:hidden;margin:60px 0}
.stat-item{background:var(--card);padding:28px;text-align:center}
.stat-value{font-size:32px;font-weight:800;color:var(--primary)}
.stat-label{font-size:13px;color:var(--dark-muted);margin-top:4px;text-transform:uppercase;letter-spacing:.05em}

/* Features Grid */
.section{padding:80px 0}
.section-title{font-size:36px;font-weight:700;text-align:center;margin-bottom:12px}
.section-subtitle{text-align:center;color:var(--muted);font-size:17px;margin-bottom:48px;max-width:500px;margin-left:auto;margin-right:auto}
.features-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.feature-card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:32px;transition:all .3s}
.feature-card:hover{border-color:var(--primary);transform:translateY(-4px)}
.feature-icon{width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;margin-bottom:16px}
.feature-icon.blue{background:rgba(59,130,246,.15)}
.feature-icon.purple{background:rgba(168,85,247,.15)}
.feature-icon.green{background:rgba(34,197,94,.15)}
.feature-card h3{font-size:18px;font-weight:600;margin-bottom:8px}
.feature-card p{font-size:14px;color:var(--muted);line-height:1.6}

/* CTA */
.cta{background:linear-gradient(135deg,rgba(59,130,246,.1),rgba(168,85,247,.05));border:1px solid rgba(59,130,246,.2);border-radius:20px;padding:60px;text-align:center;margin:40px 0 80px}
.cta h2{font-size:30px;font-weight:700;margin-bottom:12px}
.cta p{color:var(--muted);margin-bottom:28px;font-size:16px}

/* Footer */
.footer{border-top:1px solid var(--border);padding:32px 0;text-align:center}
.footer p{font-size:13px;color:var(--dark-muted)}
.footer .server-info{display:flex;align-items:center;gap:16px;justify-content:center;margin-top:12px;font-size:12px;color:var(--dark-muted)}
.footer .dot{width:6px;height:6px;border-radius:50%;background:var(--green);display:inline-block}

/* About page */
.about-hero{padding:80px 0 40px;text-align:center}
.about-hero h1{font-size:42px;font-weight:700;margin-bottom:16px}
.team-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:48px}
.team-card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:32px;text-align:center}
.team-avatar{width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--purple));margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;color:#fff}
.team-card h3{font-size:16px;font-weight:600;margin-bottom:4px}
.team-card p{font-size:13px;color:var(--muted)}

/* Services page */
.service-card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:36px;display:flex;gap:24px;margin-bottom:20px;transition:border .3s}
.service-card:hover{border-color:var(--primary)}
.service-num{font-size:40px;font-weight:800;color:rgba(59,130,246,.2);line-height:1}
.service-card h3{font-size:20px;font-weight:600;margin-bottom:8px}
.service-card p{font-size:14px;color:var(--muted)}
.service-price{margin-top:12px;font-size:24px;font-weight:700;color:var(--primary)}
.service-price span{font-size:13px;color:var(--muted);font-weight:400}

/* Contact */
.contact-grid{display:grid;grid-template-columns:1fr 1fr;gap:40px}
.contact-info{display:flex;flex-direction:column;gap:24px}
.contact-item{display:flex;gap:16px;align-items:flex-start}
.contact-item-icon{width:44px;height:44px;border-radius:11px;background:rgba(59,130,246,.1);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
.contact-item h4{font-size:15px;font-weight:600;margin-bottom:4px}
.contact-item p{font-size:14px;color:var(--muted)}
.form-group{margin-bottom:16px}
.form-group label{display:block;font-size:13px;font-weight:500;margin-bottom:6px;color:var(--muted)}
.form-input{width:100%;padding:12px 16px;background:var(--card);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;outline:none;transition:border .2s}
.form-input:focus{border-color:var(--primary)}
textarea.form-input{resize:vertical;min-height:120px}

@media(max-width:768px){
  .hero h1{font-size:32px}
  .features-grid,.team-grid{grid-template-columns:1fr}
  .stats-bar{grid-template-columns:1fr 1fr}
  .contact-grid{grid-template-columns:1fr}
  .hero-buttons{flex-direction:column;align-items:center}
  .nav-links{display:none}
}
</style>
</head>
<body>
<nav class="navbar"><div class="container">
<a href="/" class="nav-brand"><span class="nav-brand-icon">Z</span>Zyntek</a>
<div class="nav-links">${navHtml}</div>
</div></nav>
${content}
<footer class="footer"><div class="container">
<p>&copy; 2026 Zyntek Solutions. Todos los derechos reservados.</p>
<div class="server-info"><span class="dot"></span> Servidor: ${os.hostname().slice(0, 12)} | Node ${process.version} | Uptime: ${Math.floor(process.uptime())}s | RAM: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB</div>
</div></footer>
</body></html>`;
}

function homePage() {
  return layout(
    "Inicio",
    `
<section class="hero"><div class="container">
<h1>Soluciones Digitales que Impulsan tu Negocio</h1>
<p>Desarrollamos software a medida, infraestructura cloud y soluciones tecnologicas para empresas que quieren crecer.</p>
<div class="hero-buttons">
<a href="/services" class="btn btn-primary">Ver Servicios</a>
<a href="/contact" class="btn btn-outline">Contactanos</a>
</div>
</div></section>

<div class="container"><div class="stats-bar">
<div class="stat-item"><div class="stat-value">50+</div><div class="stat-label">Proyectos</div></div>
<div class="stat-item"><div class="stat-value">99.9%</div><div class="stat-label">Uptime</div></div>
<div class="stat-item"><div class="stat-value">24/7</div><div class="stat-label">Soporte</div></div>
<div class="stat-item"><div class="stat-value">15+</div><div class="stat-label">Clientes</div></div>
</div></div>

<section class="section"><div class="container">
<h2 class="section-title">Lo que Hacemos</h2>
<p class="section-subtitle">Tecnologia de punta para resolver los problemas reales de tu empresa</p>
<div class="features-grid">
<div class="feature-card"><div class="feature-icon blue">&#x1f680;</div><h3>Desarrollo Web</h3><p>Aplicaciones web modernas con React, Next.js y NestJS. Rendimiento y escalabilidad garantizados.</p></div>
<div class="feature-card"><div class="feature-icon purple">&#x2601;&#xfe0f;</div><h3>Cloud & DevOps</h3><p>Infraestructura en la nube con Docker, Kubernetes y CI/CD automatizado para despliegues sin friccion.</p></div>
<div class="feature-card"><div class="feature-icon green">&#x1f6e1;&#xfe0f;</div><h3>Ciberseguridad</h3><p>Auditorias de seguridad, SSL, firewalls y monitoreo continuo para proteger tus datos y aplicaciones.</p></div>
<div class="feature-card"><div class="feature-icon blue">&#x1f4f1;</div><h3>Apps Moviles</h3><p>Aplicaciones nativas y multiplataforma con React Native para iOS y Android.</p></div>
<div class="feature-card"><div class="feature-icon purple">&#x1f4ca;</div><h3>Data & Analytics</h3><p>Dashboards, reportes automatizados y procesamiento de datos en tiempo real.</p></div>
<div class="feature-card"><div class="feature-icon green">&#x1f916;</div><h3>IA & Automatizacion</h3><p>Chatbots, procesamiento de lenguaje natural y automatizacion de procesos empresariales.</p></div>
</div>
</div></section>

<div class="container"><div class="cta">
<h2>Listo para Digitalizar tu Negocio?</h2>
<p>Agenda una consulta gratuita y descubre como podemos ayudarte.</p>
<a href="/contact" class="btn btn-primary">Empezar Ahora</a>
</div></div>
`,
    "/"
  );
}

function aboutPage() {
  return layout(
    "Nosotros",
    `
<section class="about-hero"><div class="container">
<h1>Nuestro Equipo</h1>
<p style="color:var(--muted);font-size:18px;max-width:600px;margin:0 auto">Somos un equipo de ingenieros y disenadores apasionados por crear tecnologia que transforma negocios.</p>
<div class="team-grid">
<div class="team-card"><div class="team-avatar">S</div><h3>Santiago</h3><p>CEO & Full-Stack Developer</p></div>
<div class="team-card"><div class="team-avatar">D</div><h3>Diana</h3><p>UX/UI Designer</p></div>
<div class="team-card"><div class="team-avatar">C</div><h3>Carlos</h3><p>DevOps Engineer</p></div>
</div>
</div></section>

<section class="section"><div class="container">
<h2 class="section-title">Nuestra Historia</h2>
<p class="section-subtitle">Desde 2023, construyendo el futuro digital de Colombia</p>
<div style="max-width:700px;margin:0 auto;background:var(--card);border:1px solid var(--border);border-radius:16px;padding:36px">
<p style="color:var(--muted);font-size:15px;line-height:1.8;margin-bottom:16px">Zyntek nacio con la vision de democratizar la tecnologia para empresas de todos los tamanos. Creemos que cada negocio merece herramientas digitales de primer nivel, sin importar su presupuesto.</p>
<p style="color:var(--muted);font-size:15px;line-height:1.8">Desde nuestros inicios, hemos trabajado con startups, pymes y grandes empresas, siempre manteniendo nuestro compromiso con la calidad, la innovacion y el servicio personalizado.</p>
</div>
</div></section>
`,
    "/about"
  );
}

function servicesPage() {
  const services = [
    { num: "01", name: "Desarrollo Web Full-Stack", desc: "Aplicaciones web completas con frontend moderno (React/Next.js), backend robusto (NestJS/Node.js), y bases de datos optimizadas. Incluye diseno responsive y despliegue.", price: "2.5M", unit: "COP/proyecto" },
    { num: "02", name: "Infraestructura Cloud", desc: "Configuracion y gestion de servidores, contenedores Docker, balanceo de carga, SSL, dominios y monitoreo 24/7. Tu propia nube privada.", price: "800K", unit: "COP/mes" },
    { num: "03", name: "Aplicaciones Moviles", desc: "Apps nativas iOS y Android con React Native. Diseno UI/UX incluido, publicacion en stores y mantenimiento continuo.", price: "4M", unit: "COP/proyecto" },
    { num: "04", name: "Consultoria & Soporte", desc: "Auditorias de codigo, migracion de sistemas legacy, capacitacion de equipos y soporte tecnico dedicado.", price: "150K", unit: "COP/hora" },
  ];

  const cardsHtml = services
    .map(
      (s) => `<div class="service-card">
<div class="service-num">${s.num}</div>
<div><h3>${s.name}</h3><p>${s.desc}</p><div class="service-price">$${s.price} <span>/ ${s.unit}</span></div></div>
</div>`
    )
    .join("");

  return layout(
    "Servicios",
    `
<section class="section"><div class="container">
<h2 class="section-title" style="margin-top:20px">Nuestros Servicios</h2>
<p class="section-subtitle">Soluciones a la medida para cada etapa de tu negocio</p>
${cardsHtml}
</div></section>

<div class="container"><div class="cta">
<h2>Necesitas algo personalizado?</h2>
<p>Cada proyecto es unico. Cuentanos tu idea y te damos una cotizacion sin compromiso.</p>
<a href="/contact" class="btn btn-primary">Solicitar Cotizacion</a>
</div></div>
`,
    "/services"
  );
}

function contactPage() {
  return layout(
    "Contacto",
    `
<section class="section"><div class="container">
<h2 class="section-title" style="margin-top:20px">Contactanos</h2>
<p class="section-subtitle">Estamos listos para ayudarte con tu proximo proyecto</p>
<div class="contact-grid">
<div class="contact-info">
<div class="contact-item"><div class="contact-item-icon">&#x1f4e7;</div><div><h4>Email</h4><p>administracion@zyntek.com.co</p></div></div>
<div class="contact-item"><div class="contact-item-icon">&#x1f4cd;</div><div><h4>Ubicacion</h4><p>Colombia</p></div></div>
<div class="contact-item"><div class="contact-item-icon">&#x1f4f1;</div><div><h4>Telefono</h4><p>+57 300 000 0000</p></div></div>
<div class="contact-item"><div class="contact-item-icon">&#x23f0;</div><div><h4>Horario</h4><p>Lunes a Viernes, 8am - 6pm COT</p></div></div>
</div>
<div>
<div style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:28px">
<h3 style="font-size:18px;margin-bottom:20px">Enviar Mensaje</h3>
<div class="form-group"><label>Nombre</label><input class="form-input" placeholder="Tu nombre"></div>
<div class="form-group"><label>Email</label><input class="form-input" type="email" placeholder="tu@email.com"></div>
<div class="form-group"><label>Mensaje</label><textarea class="form-input" placeholder="Cuentanos sobre tu proyecto..."></textarea></div>
<button class="btn btn-primary" style="width:100%;justify-content:center">Enviar Mensaje</button>
</div>
</div>
</div>
</div></section>
`,
    "/contact"
  );
}

const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];
  const handler = pages[url];

  if (handler) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(handler());
  } else {
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end(
      layout("404", `<section class="hero"><div class="container"><h1>404</h1><p>Pagina no encontrada</p><a href="/" class="btn btn-primary">Volver al Inicio</a></div></section>`, "")
    );
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("Zyntek Solutions corriendo en puerto " + PORT);
});
