# Pipeline de CI/CD

## Resumen

El proyecto cuenta con dos canalizaciones complementarias:

- **GitHub Actions** (`.github/workflows/ci-cd.yml`): ejecuta validaciones
  automáticas en GitHub para pull requests y pushes destinados a integración o
  despliegue.
- **Jenkins** (`Jenkinsfile`): ejecuta el mismo ciclo en infraestructura
  On-Premise y permite archivar el build de producción desde el agente Jenkins.

Ambos pipelines instalan dependencias de forma reproducible con `npm ci`,
ejecutan las validaciones del proyecto y envían el análisis a **SonarQube
Cloud** (o, como alternativa, a un servidor SonarQube self-hosted). El build de producción se ejecuta únicamente para ramas de entrega
o tags.

## Arquitectura de las canalizaciones

### GitHub Actions

El workflow usa `ubuntu-latest`, Node.js 20 y caché de npm.

| Evento | Ejecución |
| --- | --- |
| Pull request hacia `develop` | `validate-and-test` |
| Push hacia `main` | `validate-and-test` y build de producción |
| Push de tag `v*.*.*` | `validate-and-test` y build de producción |

El job `validate-and-test` realiza checkout con `fetch-depth: 0`, instala las
dependencias, ejecuta `npm run check`, ejecuta `npm run test:coverage` (genera
`coverage/lcov.info`) y lanza el análisis de SonarQube + Quality Gate con
`npm run sonar`.

Si faltan `SONAR_TOKEN` o `SONAR_HOST_URL`, o el servidor no responde `UP`
desde el runner, el análisis se reporta como **OMITIDO** (nunca como aprobado) y
el resto del pipeline decide el resultado. Al final de cada run, el **resumen
del job** (pestaña _Summary_) muestra una tabla con el resultado de cada etapa,
incluida una línea inequívoca de SonarQube: `✅ Quality Gate aprobado`,
`❌ Quality Gate rechazado…` o `⚠️ OMITIDO — <motivo>. No es un Quality Gate aprobado.`

El job `production-build-and-release` depende de `validate-and-test`, ejecuta
`npm run build` con `NODE_ENV=production` y publica el contenido de `dist/`
como el artefacto `production-dist`.

> Nota: la condición interna del job de producción también contempla
> `master`, pero el trigger `push` actual del workflow está configurado para
> `main` y tags. Para activar el pipeline automáticamente desde `master`, esa
> rama debe agregarse a `on.push.branches`.

### Jenkins On-Premise

El `Jenkinsfile` usa cualquier agente disponible (`agent any`) y solicita la
instalación administrada `NodeJS-20`.

Las etapas son:

1. **Checkout & Setup**: obtiene el código con `checkout scm` y ejecuta
   `npm ci`.
2. **Validation**: ejecuta `npm run check`.
3. **Tests & Coverage**: ejecuta `npm run test:coverage`.
4. **SonarQube + Quality Gate**: ejecuta `npm run sonar` con
   `-Dsonar.qualitygate.wait=true`; si el gate falla, falla el build. Si faltan
   las credenciales o el servidor no responde `UP`, la etapa se omite con un
   aviso (y el build queda _unstable_ en el segundo caso).
5. **Build Production**: se ejecuta en `main`, `master` o cuando la ejecución
   corresponde a un tag; compila y archiva `dist/**`.

El bloque `post { always { cleanWs() } }` elimina el workspace al finalizar
cualquier ejecución, tanto exitosa como fallida.

## Secretos de GitHub Repository Secrets

Configurar los siguientes secretos en **Repository Settings → Secrets and
variables → Actions → Repository secrets**:

| Secreto | Obligatorio | Uso |
| --- | --- | --- |
| `SONAR_TOKEN` | No (sin él se omite SonarQube) | Token de análisis. Cloud: _My Account → Security_. |
| `SONAR_HOST_URL` | No (sin él se omite SonarQube) | `https://sonarcloud.io` en Cloud. En self-hosted, una URL alcanzable **desde los runners de GitHub**. |
| `SONAR_PROJECT_KEY` | No (default `pms-hotel-boutique` de `sonar-project.properties`) | projectKey. En Cloud es el que asigna SonarQube Cloud al importar el repo (suele ser `<organizacion>_pms-hotel-boutique`). |
| `SONAR_ORGANIZATION` | Solo en SonarQube Cloud | Key de la organización en SonarQube Cloud. Vacío = self-hosted. |

El workflow los consume mediante `${{ secrets.NOMBRE_DEL_SECRETO }}`. Los
valores no deben escribirse en el repositorio, en archivos YAML ni en logs.
Después de guardarlos, validar que el token tenga permisos para analizar el
proyecto correspondiente.

## Credenciales de Jenkins

En **Manage Jenkins → Credentials → Global** crear credenciales de tipo
**Secret text** con:

| ID de credencial | Valor |
| --- | --- |
| `sonar-token` | Token de SonarQube. |
| `sonar-host-url` | URL del servidor SonarQube. |
| `sonar-project-key` | Project key del frontend (opcional). |
| `sonar-organization` | Key de la organización (solo SonarQube Cloud). |

El `Jenkinsfile` expone temporalmente esas credenciales como variables de
entorno. No se deben registrar los valores ni sustituirlos por claves literales
en el archivo.

El agente Jenkins necesita `curl` y el tool NodeJS identificado como
`NodeJS-20`. El scanner es la devDependency `@sonar/scan`, así que no hace
falta instalar `sonar-scanner` ni el plugin de SonarQube en Jenkins.

## Quality Gate y métricas

El análisis de Sonar revisa el código fuente y calcula las métricas que la
configuración del proyecto haya incluido en su Quality Gate:

- **Bugs**: problemas de lógica o comportamiento que pueden provocar fallos.
- **Code Smells**: patrones de diseño o mantenimiento que aumentan la deuda
  técnica, aunque no sean fallos funcionales inmediatos.
- **Vulnerabilidades OWASP**: problemas de seguridad detectados por las reglas
  de análisis estático aplicables al código.
- **Cobertura**: proporción de código ejecutado por las pruebas, importada
  desde el reporte LCOV `coverage/lcov.info`.

La configuración común del análisis vive en `sonar-project.properties`:

```text
sonar.sources=src
sonar.tests=tests,scripts
sonar.javascript.lcov.reportPaths=coverage/lcov.info
```

`npm run test:coverage` ejecuta `npm test` bajo `c8` (`.c8rc.json`) y escribe
`coverage/lcov.info`. Las pruebas se empaquetan con esbuild en `.cache/` con
`sourcemap: 'inline'`, y `c8` las remapea a los archivos de `src/`
(`exclude-after-remap`). Si se agrega un script `scripts/test-*.mjs` que
empaqueta con esbuild, debe incluir `sourcemap: 'inline'` para que cuente en la
cobertura.

## SonarQube Cloud (opción en uso)

El análisis corre contra **SonarQube Cloud** (`https://sonarcloud.io`), igual
que la app móvil. El workflow y el Jenkinsfile detectan Cloud porque
`SONAR_ORGANIZATION` tiene valor y agregan `-Dsonar.organization`; con
`SONAR_ORGANIZATION` vacío funcionan como self-hosted.

### Configuración (una sola vez)

1. En sonarcloud.io, dentro de la organización, **importar el repo**
   `PGC36/pms-hotel-boutique` (_+ → Analyze new project_).
2. En el proyecto: _Administration → Analysis Method_ → **desactivar Automatic
   Analysis**. Si queda activo, el análisis desde CI falla ("You are running CI
   analysis while Automatic Analysis is enabled") y además no importa la
   cobertura de `coverage/lcov.info`.
3. Generar un token en _My Account → Security_.
4. Cargar en GitHub los secrets `SONAR_TOKEN`,
   `SONAR_HOST_URL=https://sonarcloud.io`, `SONAR_PROJECT_KEY` (el key que
   muestra _Project Information_) y `SONAR_ORGANIZATION`.

En el plan gratuito, SonarQube Cloud aplica el gate **Sonar way** (entre otras
condiciones, cobertura ≥ 80 % en código nuevo). La organización tiene activado
_Ignore duplication and coverage on small changes_: cobertura y duplicación se
ignoran en cambios de menos de 20 líneas nuevas. SonarQube Cloud analiza PR y
ramas: en GitHub Actions el scanner detecta el PR solo.

Análisis manual en local contra Cloud:

```bash
npm run test:coverage
npm run sonar -- -Dsonar.host.url=https://sonarcloud.io -Dsonar.organization=<organizacion> -Dsonar.projectKey=<project-key> -Dsonar.token=<SONAR_TOKEN> -Dsonar.qualitygate.wait=true
```

## Empaquetado de producción

El empaquetado sigue este flujo:

1. El pipeline instala las dependencias con `npm ci`.
2. Ejecuta `npm run build` usando la configuración de producción.
3. Vite genera la salida compilada en `dist/`.
4. El pipeline conserva esa salida como artefacto:
   - GitHub Actions: artefacto `production-dist` mediante
     `actions/upload-artifact@v4`.
   - Jenkins: archivos `dist/**` mediante `archiveArtifacts`, con fingerprint
     habilitado.

El directorio `dist/` es el entregable estático para la siguiente etapa de
publicación o despliegue. No contiene secretos ni debe utilizarse para
almacenar credenciales.
