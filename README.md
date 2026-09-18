# AGRITECH 🌾🤖
### Sistema Inteligente para el Monitoreo y Gestión de Cultivos mediante IA e IoT

![GitHub License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)
![Status](https://img.shields.io/badge/status-production--ready-blue?style=for-the-badge)
![AI Model](https://img.shields.io/badge/AI%20Model-Gemini%201.5%20Flash-4285F4?style=for-the-badge&logo=google-gemini)
![Location](https://img.shields.io/badge/Location-Carmen%20de%20Carupa-E67E22?style=for-the-badge)

---

## 📄 Descripción del Proyecto

**AGRITECH** es una solución tecnológica integral diseñada para transformar la agricultura tradicional en un ecosistema de precisión. Mediante la convergencia de **Inteligencia Artificial (IA)** e **Internet de las Cosas (IoT)**, la plataforma permite a los productores de papa en **Carmen de Carupa, Cundinamarca**, monitorear variables críticas, predecir riesgos climáticos y optimizar la toma de decisiones basada en datos reales.

El sistema no solo funciona como una herramienta de monitoreo, sino también como un hub educativo que democratiza el acceso al conocimiento técnico avanzado para el sector agropecuario.

---

## 🎯 Objetivos

- **Monitoreo Preciso:** Supervisar en tiempo real la humedad del suelo, temperatura y condiciones climáticas.
- **Predicción de Riesgos:** Implementar algoritmos de IA para anticipar heladas y enfermedades fitosanitarias.
- **Optimización de Recursos:** Reducir el desperdicio de agua y agroquímicos mediante análisis predictivo.
- **Formación Técnica:** Ofrecer programas académicos especializados en IA para el desarrollo rural.

---

## 🚀 Características Principales

*   **Landing Page Responsive:** Interfaz ultra-moderna adaptada a cualquier dispositivo.
*   **Asistente Inteligente (Agri-Bot):** Chatbot potenciado por Gemini API con entrenamiento en base de conocimiento agrícola.
*   **Gestión de Datos IoT:** Visualización de telemetría capturada por sensores de campo.
*   **Arquitectura Modular:** Sistema escalable desarrollado bajo principios de Clean Code.
*   **Dashboard de Cursos:** Catálogo dinámico de formación en IA aplicada.

---

## 📚 Oferta Académica Especializada

A continuación se detallan los programas de formación técnica integrados en la plataforma. Para más detalles, consulte el [Plan de Curso](PLAN_DE_CURSO.md).

| Curso | Descripción | Duración | Nivel | Inversión (COP) |
| :--- | :--- | :--- | :--- | :--- |
| **1. Fundamentos de IA en el Agro** | Bases conceptuales de la inteligencia artificial y su impacto en la seguridad alimentaria. | 20 horas | Básico | $150,000 |
| **2. Introducción a ML Agrícola** | Implementación de modelos predictivos para estimación de cosecha y calidad del suelo. | 40 horas | Intermedio | $320,000 |
| **3. ML y Algoritmos Genéticos** | Optimización de rutas de riego y distribución de cultivos mediante computación evolutiva. | 35 horas | Avanzado | $450,000 |
| **4. Deep Learning Fundamentos** | Redes neuronales aplicadas a la detección de anomalías en variables climáticas. | 45 horas | Avanzado | $580,000 |
| **5. Visión Artificial en Papa** | Detección temprana de plagas (Phytophthora) mediante Deep Learning y drones. | 50 horas | Experto | $720,000 |

---

## 🏗️ Arquitectura del Proyecto

El sistema está diseñado bajo un paradigma modular, garantizando que cada sección del sistema sea independiente y fácil de mantener.

```bash
/project
│
├── index.html              # Punto de entrada principal (DOM Structure)
├── /assets                 # Recursos estáticos del sistema
│   ├── /css                # Estilos base y tokens de diseño
│   ├── /js                 # Lógica global y utilidades
│   ├── /images             # Activos visuales de alta resolución
│   └── /icons              # Simbología técnica y UI
│
├── /components             # Módulos de interfaz (Vanilla JS)
│   ├── navbar.js           # Navegación dinámica y responsive
│   ├── courses.js          # Renderizador de oferta académica
│   ├── instructors.js      # Gestión de perfiles docentes
│   ├── chatbot.js          # Lógica de interfaz del Agri-Bot
│   └── footer.js           # Información institucional y legal
│
├── /data                   # Capa de datos persistente (JSON)
│   ├── courses.json        # Base de datos de cursos
│   ├── instructors.json    # Base de datos de expertos
│   └── knowledge-base.json # Cerebro local del asistente inteligente
│
├── /services               # Servicios de comunicación externa
│   └── geminiService.js    # Conector oficial con Google AI Studio
│
├── .env.example            # Plantilla de configuración de entorno
└── README.md               # Documentación técnica maestra
```

---

## 🤖 Integración con Gemini API

El **Agri-Bot** de AGRITECH utiliza el modelo `gemini-1.5-flash` para interactuar con los usuarios.

### 🧠 Base de Conocimiento
El asistente está restringido mediante un *System Prompt* robusto que lo obliga a responder **exclusivamente** basándose en `knowledge-base.json`. No responde consultas ajenas a la agricultura técnica e institucional de AGRITECH.

### 🔐 Seguridad y Variables de Env
Para el despliegue, es necesario configurar la llave de API en un archivo `.env`:

```bash
# Google AI Studio API Key
GEMINI_API_KEY=YOUR_API_KEY_HERE
```

---

## 🛠️ Instalación y Configuración

Siga estos pasos para ejecutar el proyecto en un entorno local:

1.  **Clonar el repositorio:**
    ```bash
    git clone https://github.com/tu-usuario/agritech.git
    cd agritech
    ```
2.  **Configurar Variables:**
    Duplique el archivo `.env.example` y renómbrelo a `.env`, luego ingrese su `GEMINI_API_KEY`.
3.  **Servidor Local:**
    Debido al uso de módulos ES6 y servicios de API, se recomienda utilizar un servidor local (Live Server o similar).

---

## 💻 Tecnologías Utilizadas

| Tecnología | Categoría | Uso en el Proyecto |
| :--- | :--- | :--- |
| **HTML5** | Estructura | Semántica avanzada para SEO agrícola. |
| **CSS3** | Diseño | Flexbox, Grid y efectos Glassmorphism. |
| **JavaScript** | Lógica | Manipulación del DOM y consumo de APIs asíncronas. |
| **JSON** | Datos | Almacenamiento local de base de conocimiento. |
| **Gemini API** | IA | Procesamiento de lenguaje natural y lógica de bot. |
| **IoT Ready** | Hardware | Esquema de datos preparado para telemetría. |

---

## 🎨 Diseño UI/UX

*   **Minimalismo Tecnológico:** Interfaz limpia con enfoque en la legibilidad de datos.
*   **Paleta de Colores:** Verde Bosque (Naturaleza) combinado con Azul Eléctrico (Tecnología).
*   **Experiencia de Usuario:** Animaciones suaves mediante transiciones CSS y carga perezosa de componentes.

---

## 🏆 Buenas Prácticas Implementadas

*   **Clean Code:** Código autodocumentado y funciones de responsabilidad única.
*   **Modularidad:** Separación estricta entre la lógica de negocio y la interfaz.
*   **Seguridad:** Gestión de credenciales fuera del código fuente.

---

## 🗺️ Roadmap Futuro

- [ ] **Dashboard de Sensores:** Integración de gráficas en tiempo real mediante Chart.js.
- [ ] **Alertas Tempranas:** Sistema de notificaciones SMS para heladas inminentes.
- [ ] **Mobile App:** Desarrollo de la versión nativa para Android/iOS.

---

## 👤 Autor e Instructores
yulieth sthephania santana


**[Tu Nombre/Estudiante]**  
*Ingeniería de Sistemas - Facultad de Ingeniería*  
*Especialista en Desarrollo Full Stack e Inteligencia Artificial aplicada.*

---
© 2024 **AGRITECH** - Innovación desde Carmen de Carupa para el mundo.
