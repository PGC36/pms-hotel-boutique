pipeline {
    agent any

    tools {
        nodejs 'NodeJS-20'
    }

    environment {
        SONAR_PROJECT_KEY = credentials('sonar-project-key')
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
                sh 'npm run test:coverage --if-present'
            }
        }

        stage('SonarQube Quality Gate') {
            steps {
                withCredentials([
                    string(credentialsId: 'sonar-token', variable: 'SONAR_TOKEN'),
                    string(credentialsId: 'sonar-host-url', variable: 'SONAR_HOST_URL')
                ]) {
                    sh '''
                        sonar-scanner \
                          -Dsonar.projectKey="$SONAR_PROJECT_KEY" \
                          -Dsonar.host.url="$SONAR_HOST_URL" \
                          -Dsonar.token="$SONAR_TOKEN"
                    '''
                }
            }
        }

        stage('Wait Quality Gate') {
            steps {
                timeout(time: 5, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
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
