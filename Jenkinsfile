// Pipeline frontend PMS Hotel Boutique (equivalente on-premise de .github/workflows/ci-cd.yml).
// Ver docs/ci-cd.md.
//
// Credenciales Jenkins (todas opcionales; si no existen, SonarQube se omite):
//   sonar-token        Secret text  -> SONAR_TOKEN
//   sonar-host-url     Secret text  -> SONAR_HOST_URL (en on-premise puede ser la URL interna)
//   sonar-project-key  Secret text  -> SONAR_PROJECT_KEY (default: sonar-project.properties)
//   sonar-organization Secret text  -> SONAR_ORGANIZATION (solo SonarQube Cloud)
pipeline {
    agent any

    tools {
        nodejs 'NodeJS-20'
    }

    stages {
        stage('Checkout & Setup') {
            steps {
                checkout scm
                sh 'npm ci'
            }
        }

        stage('Validation') {
            steps {
                sh 'npm run check'
            }
        }

        stage('Tests & Coverage') {
            steps {
                sh 'npm run test:coverage'
            }
        }

        stage('SonarQube + Quality Gate') {
            steps {
                script {
                    try {
                        withCredentials([
                            string(credentialsId: 'sonar-token', variable: 'SONAR_TOKEN'),
                            string(credentialsId: 'sonar-host-url', variable: 'SONAR_HOST_URL')
                        ]) {
                            def projectKey = ''
                            try {
                                withCredentials([string(credentialsId: 'sonar-project-key', variable: 'KEY')]) {
                                    projectKey = env.KEY
                                }
                            } catch (ignored) {
                                echo 'sonar-project-key no configurada; se usa el projectKey de sonar-project.properties.'
                            }
                            def organization = ''
                            try {
                                withCredentials([string(credentialsId: 'sonar-organization', variable: 'ORG')]) {
                                    organization = env.ORG
                                }
                            } catch (ignored) {
                                echo 'sonar-organization no configurada; se asume SonarQube self-hosted.'
                            }
                            def up = sh(script: 'curl -fsS --max-time 20 "${SONAR_HOST_URL%/}/api/system/status" | grep -q \'"status":"UP"\'', returnStatus: true) == 0
                            if (!up) {
                                unstable('SonarQube no responde UP; se omite el análisis (no equivale a un Quality Gate aprobado).')
                                return
                            }
                            withEnv(["SONAR_PROJECT_KEY=${projectKey}", "SONAR_ORGANIZATION=${organization}"]) {
                                sh '''
                                    npm run sonar -- \
                                      -Dsonar.host.url="$SONAR_HOST_URL" \
                                      -Dsonar.token="$SONAR_TOKEN" \
                                      ${SONAR_PROJECT_KEY:+-Dsonar.projectKey="$SONAR_PROJECT_KEY"} \
                                      ${SONAR_ORGANIZATION:+-Dsonar.organization="$SONAR_ORGANIZATION"} \
                                      -Dsonar.qualitygate.wait=true \
                                      -Dsonar.qualitygate.timeout=300
                                '''
                            }
                        }
                    } catch (org.jenkinsci.plugins.credentialsbinding.impl.CredentialNotFoundException e) {
                        echo "SonarQube OMITIDO (no es un Quality Gate aprobado): ${e.message}"
                    }
                }
            }
        }

        stage('Build Production') {
            when {
                anyOf {
                    branch 'main'
                    branch 'master'
                    buildingTag()
                }
            }
            steps {
                sh 'npm run build'
                archiveArtifacts artifacts: 'dist/**', fingerprint: true
            }
        }
    }

    post {
        always {
            cleanWs()
        }
    }
}
