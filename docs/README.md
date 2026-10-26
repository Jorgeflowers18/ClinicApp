# docs — Skills de Claude

Carpeta para las skills de Claude del proyecto ClinicApp: instrucciones reutilizables para tareas que se repiten (crear un módulo, agregar un par de API Mock/Real, actualizar los backlogs, etc.).

Cada skill va en su propia carpeta con un archivo `SKILL.md`:

```
docs/
└── <nombre-de-la-skill>/
    ├── SKILL.md        # frontmatter (name, description) + instrucciones
    └── ...             # archivos de apoyo opcionales (plantillas, ejemplos)
```

> Claude Code descubre las skills automáticamente solo en `.claude/skills/`. Para que una skill de esta carpeta se pueda invocar con `/<nombre>`, hay que copiarla o enlazarla allí, o pedirle a Claude que la lea desde `docs/`.

La documentación técnica y de negocio del proyecto sigue en [`documentacion/`](../documentacion/).
