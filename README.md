Smart Home Control Dashboard 🏡
This project is a single-file, full-stack Smart Home Control Dashboard designed to simulate the control of various smart devices. It's a demonstration of handling real-time data, state management, and an interactive user interface.

✨ Features
Simulated IoT Integration: A mock "IoT hub" generates real-time data for temperature, light levels, and device status.

Interactive UI: The dashboard includes interactive controls such as sliders for dimming lights and buttons for toggling devices on and off.

Automation Rules: Users can create simple "if this, then that" rules (e.g., "If the temperature exceeds 75°F, turn on the fan").

Historical Data: Historical data from simulated devices is stored and visualized in a line chart using recharts.

User and Device Management: Data is persisted and updated in real time using Firebase Firestore, with a unique user ID for each session.

🚀 How to Run
This project is a single-file React application. You can integrate this file into an existing React project or run it in a development environment that supports single-file components.

Set up a Firebase Project:

Go to the Firebase Console.

Create a new project.

Enable Firestore Database.

Set up the security rules to allow authenticated reads and writes.

(Optional but recommended for a real app) Set up a user authentication method.

Add Your Firebase Config:

The application uses global variables (__firebase_config, __app_id, __initial_auth_token) for configuration. If you're running this locally, you'll need to manually provide these values or set up a .env file and import them.

Run the App:

Install dependencies (react, firebase, recharts, lucide-react).

Run your React development server.

🛠️ Technologies Used
Frontend: React, Tailwind CSS

State Management: React Hooks (useState, useEffect)

Data Storage: Firebase Firestore

Charting: Recharts

Icons: Lucide React

---

Here are the steps you need to follow to get the Smart Home Dashboard running:

Step 1: Set Up Your Firebase Project
You'll need a Firebase project to act as the backend for your application. This is where the real-time data for your devices and rules will be stored.

Go to the Firebase Console and create a new project.

In your new project, navigate to the Build section and select Firestore Database.

Create a new database. You can start in test mode for simplicity, but for a real-world application, you'll need to configure the security rules to allow authenticated reads and writes.

Step 2: Configure Your Application
The code is set up to work in the Canvas environment using special global variables. For local development, you need to provide your own Firebase configuration.

In the Firebase Console, go to Project settings (the gear icon) and click on Your apps. If you don't have a web app yet, create one.

Find your Firebase config object. It will look like a JavaScript object with keys like apiKey, authDomain, projectId, etc.

In your local project, create a file (e.g., .env) and add your config variables to it. You will then need to load these variables into your application.

Step 3: Install Dependencies and Run
The final step is to get the necessary libraries and start the development server.

Open your terminal in the project's root directory.

Install the required packages by running:

Bash

npm install react firebase recharts lucide-react tailwindcss
Start your React development server. The command for this is typically:

Bash

npm start
Once the server is running, the app should open in your browser, and you will see the dashboard populated with mock data.

Let me know if you run into any issues during these steps or if you'd like me to help with a specific part of the setup!

---
