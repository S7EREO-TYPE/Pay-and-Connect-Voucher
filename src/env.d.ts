declare global{
    namespace NodeJS{
        interface ProcessEnv{
            STUDENT_EMAIL:string
            STUDENT_PASSWORD:string
            NOTIFICATION_EMAIL:string
            NOTIFICATION_EMAIL_PASSWORD:string
            GOOGLE_API_KEY:string
        }
    }
}

export {};