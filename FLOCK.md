# Flock: Developer Documentation

This document provides a comprehensive overview of the Flock mobile application, its architecture, and development conventions.

## 1. Project Overview

Flock is a mobile ride-sharing application designed for university students in the Los Angeles area. It facilitates carpooling by allowing users to post, find, and book rides between campuses and popular destinations.

### 1.1. Target Audience & Scope

The application specifically targets students from:

-   **UCLA** (University of California, Los Angeles)
-   **USC** (University of Southern California)
-   **LMU** (Loyola Marymount University)

It provides preset locations relevant to students, such as major airports (LAX, Burbank) and campus areas, to streamline the ride-posting process.

## 2. Core Features

-   **User Authentication:** Secure sign-up and sign-in functionality.
-   **Post a Ride:** Users can offer rides by providing details such as origin, destination, date, time, available seats, and price.
-   **Find a Ride:** (Inferred) Users can search for available rides based on their travel needs.
-   **Ride Details:** (Inferred) View detailed information about a specific ride.
-   **Chat:** (Inferred) Real-time messaging between drivers and passengers.
-   **Profile Management:** (Inferred) Users can view and manage their profiles.
-   **Push Notifications:** The app is configured to handle push notifications for real-time updates.

## 3. Technical Architecture

Flock is built using a modern mobile and backend stack, emphasizing a modular and maintainable structure.

### 3.1. Frontend

-   **Framework:** React Native with Expo.
-   **Language:** TypeScript.
-   **Navigation:** React Navigation is used for managing the app's screen flow, employing a combination of a Drawer Navigator for the main menu and Stack Navigators for specific features (e.g., Find Ride, Chat).
-   **Entry Point:** `App.tsx` is the main entry point, handling authentication state, theme provisioning, and the root navigator setup.

### 3.2. Backend

-   **Platform:** Supabase.
-   **Services:**
    -   **Authentication:** Manages user accounts and sessions.
    -   **Database:** A PostgreSQL database stores application data, such as user profiles and ride information (`trips`).
    -   **Serverless Functions:** Custom logic is implemented in `supabase/functions/` to handle tasks like sending notifications. These are written in TypeScript and executed via Deno.

### 3.3. Key Technologies

-   **React Native:** Cross-platform mobile app development.
-   **Expo:** A framework and platform for universal React applications.
-   **Supabase:** Open-source Firebase alternative for backend-as-a-service.
-   **React Navigation:** For routing and navigation.
-   **TypeScript:** For static typing and improved code quality.

## 4. Design System & Theming

Flock features a comprehensive and well-structured design system located in `src/theme/`. This system ensures a consistent and themeable user interface.

### 4.1. Color Palette

The application supports both **light** and **dark** modes. The color palettes are defined in `src/theme/colors.ts` and are functionally organized.

#### Light Theme Colors
| Name | Hex | Usage |
| --- | --- | --- |
| `primary` | #2563eb | Core brand color, interactive elements |
| `primaryLight` | #3b82f6 | Lighter shade for hover/active states |
| `primaryDark` | #1d4ed8 | Darker shade for pressed states |
| `background` | #ffffff | Main screen background |
| `card` | #ffffff | Card component background |
| `surface` | #f8fafc | Surface color for elevated components |
| `text` | #0f172a | Primary text color |
| `textSecondary`| #475569 | Secondary text for less emphasis |
| `border` | #e2e8f0 | Component borders |
| `success` | #10b981 | Success state indicators |
| `warning` | #f59e0b | Warning state indicators |
| `error` | #ef4444 | Error state indicators |

#### Dark Theme Colors
| Name | Hex | Usage |
| --- | --- | --- |
| `primary` | #3b82f6 | Core brand color in dark mode |
| `background` | #0f172a | Main screen background |
| `card` | #1e293b | Card component background |
| `surface` | #334155 | Surface color for elevated components |
| `text` | #f8fafc | Primary text color |
| `textSecondary`| #cbd5e1 | Secondary text for less emphasis |
| `border` | #334155 | Component borders |


### 4.2. Typography

A consistent typography system is defined in `src/theme/typography.ts`. It establishes a set of predefined text styles (e.g., `heading1`, `body`, `caption`) and tokens for font sizes, weights, and line heights. This ensures visual consistency for all text across the app.

### 4.3. Reusable Components

The file `src/theme/components.tsx` contains a library of styled, reusable UI components built upon the theme's color and typography systems. These include:

-   `Button`
-   `Input`
-   `Card`
-   `Screen`
-   And more...

Using these standardized components is crucial for maintaining a consistent look and feel.

## 5. Key Files & Directories

-   **`App.tsx`**: The main application entry point. Handles auth state, notifications, and sets up the Theme and Navigation containers.
-   **`src/navigation/DrawerNavigator.tsx`**: Defines the primary navigation structure, including the drawer menu and nested feature stacks. Contains sign-out logic and the theme-switcher UI.
-   **`src/screens/`**: Contains all the individual screens of the application.
    -   `PostRideScreen.tsx`: A core feature screen for creating new ride listings. A good example of form handling and Supabase interaction.
-   **`src/services/supabase.ts`**: Configures and exports the singleton `supabase` client, which is the central point of interaction with the backend.
-   **`src/theme/`**: The heart of the app's design system.
    -   `index.ts`: Centralizes exports for the theme system.
    -   `colors.ts`: Defines light and dark mode color palettes.
    -   `typography.ts`: Defines text styles and font tokens.
    -   `components.tsx`: Provides a library of reusable, themed UI components.
-   **`src/types/`**: Contains TypeScript type definitions for core data models like `trip.ts`.
-   **`supabase/functions/`**: Contains serverless backend logic for the application, such as sending push notifications.

For a deeper understanding of the system, further investigation into `src/services/supabase.ts` and the individual functions within `supabase/functions/` is recommended.
