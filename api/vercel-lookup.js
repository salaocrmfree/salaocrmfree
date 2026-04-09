export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { token, domain } = req.body;

  if (!token || !domain) {
    return res.status(400).json({ error: "Missing token or domain" });
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  try {
    // 1. Validate token
    const userRes = await fetch("https://api.vercel.com/v2/user", { headers });
    if (!userRes.ok) {
      return res.status(401).json({ error: "Token da Vercel invalido ou expirado." });
    }

    // 2. List all projects
    const projectsRes = await fetch("https://api.vercel.com/v9/projects?limit=100", { headers });
    if (!projectsRes.ok) {
      return res.status(500).json({ error: "Erro ao listar projetos da Vercel." });
    }
    const projectsData = await projectsRes.json();
    const projects = projectsData.projects || [];

    if (projects.length === 0) {
      return res.status(404).json({ error: "Nenhum projeto encontrado nesta conta Vercel." });
    }

    const normalizedDomain = domain.toLowerCase().replace(/^www\./, "");

    // 3. Try to match by domain/alias
    for (const project of projects) {
      const aliases = [];

      // Production aliases
      if (project.targets?.production?.alias) {
        aliases.push(...project.targets.production.alias.map((a) => a.toLowerCase()));
      }
      // Project aliases
      if (project.alias) {
        for (const a of project.alias) {
          if (typeof a === "string") aliases.push(a.toLowerCase());
          else if (a.domain) aliases.push(a.domain.toLowerCase());
        }
      }
      // Default vercel.app domain
      aliases.push(`${project.name.toLowerCase()}.vercel.app`);

      if (aliases.includes(normalizedDomain)) {
        return res.status(200).json({
          success: true,
          project: { id: project.id, name: project.name },
        });
      }
    }

    // 4. Localhost fallback: return the first project
    if (
      normalizedDomain === "localhost" ||
      normalizedDomain.startsWith("localhost:") ||
      normalizedDomain === "127.0.0.1" ||
      normalizedDomain.startsWith("127.0.0.1:")
    ) {
      return res.status(200).json({
        success: true,
        project: { id: projects[0].id, name: projects[0].name },
      });
    }

    return res.status(404).json({
      error: `Nenhum projeto encontrado para o dominio "${domain}". Verifique se o deploy foi feito corretamente.`,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Erro interno" });
  }
}
