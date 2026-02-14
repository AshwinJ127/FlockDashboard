# Flock App Backend Overview

This document provides all the necessary information to connect to and interact with the Flock application's backend, which is powered by Supabase.

## 1. Connection Details

You can connect to the Supabase project using the following credentials. These are public-facing and can be used in a client-side application.

- **Supabase Project URL:** `https://fnmsbbtskyfwmcojqukc.supabase.co`
- **Supabase Anon (Public) Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZubXNiYnRza3lmd21jb2pxdWtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0NDcwNDYsImV4cCI6MjA2MTAyMzA0Nn0.vStl4iZ5Jpn_wOBEkhhl8x1tVOe17Faeb07gPdu2Q-s`

### Example: Initializing the Supabase Client

To get started, install the Supabase JavaScript client library:

```bash
npm install @supabase/supabase-js
```

Then, use the credentials to create a client instance:

```javascript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fnmsbbtskyfwmcojqukc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZubXNiYnRza3lmd21jb2pxdWtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0NDcwNDYsImV4cCI6MjA2MTAyMzA0Nn0.vStl4iZ5Jpn_wOBEkhhl8x1tVOe17Faeb07gPdu2Q-s';

const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

## 2. Authentication

The application uses Supabase's built-in authentication. Users in the mobile app sign up and log in via Supabase Auth.

For a dashboard or admin panel, you have two options:
1.  **Admin User Account:** Create a new user account with special privileges directly from the Supabase dashboard (`Authentication` -> `Users` -> `Invite user`). You can then use this user's credentials to log in from your dashboard application.
2.  **Service Role Key:** For server-side operations where you need to bypass Row Level Security (RLS), you can use the `service_role` key. This key should be kept secret and only used in a secure backend environment. You can find this key in your Supabase project settings: `Project Settings` -> `API` -> `Project API keys`.

## 3. Data Models and API

The database schema is managed by Supabase. The primary tables are `trips`, `profiles`, `messages`, `chats`, and `chat_participants`.

### Table: `profiles`

Stores public user profile information. This table has a one-to-one relationship with the `auth.users` table.

- `id` (uuid): Foreign key to `auth.users.id`.
- `first_name` (text)
- `last_name` (text)
- `updated_at` (timestamptz)

**Example: Fetch a user's profile**
```javascript
async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', userId)
    .single();
  
  if (error) {
    console.error('Error fetching profile:', error);
    return null;
  }
  
  return data;
}
```

### Table: `trips`

Stores all the ride postings.

- `id` (uuid): Primary key.
- `user_id` (uuid): Foreign key to `profiles.id`. The user who posted the ride.
- `pickup` (text): The starting location.
- `dropoff` (text): The destination.
- `seats` (integer): Number of available seats.
- `departure_time` (timestamptz): The scheduled departure time.
- `ask` (integer, optional): The suggested price for the ride.
- `created_at` (timestamptz): Timestamp of when the ride was posted.

**Example: Fetch upcoming trips**
```javascript
async function getUpcomingTrips() {
  const { data, error } = await supabase
    .from('trips')
    .select(`
      *,
      driver:profiles(first_name, last_name)
    `)
    .gt('departure_time', new Date().toISOString())
    .order('departure_time', { ascending: true });

  if (error) {
    console.error('Error fetching trips:', error);
    return [];
  }
  
  return data;
}
```

### Table: `chats` and `chat_participants`

These tables manage the chat conversations. A chat is created between two or more users.

- `chats`
    - `id` (uuid): Primary key for the chat room.
- `chat_participants`
    - `chat_id` (uuid): Foreign key to `chats.id`.
    - `user_id` (uuid): Foreign key to `profiles.id`.

### Table: `messages`

Stores individual chat messages.

- `id` (bigint): Primary key.
- `chat_id` (uuid): Foreign key to `chats.id`. Identifies the conversation.
- `user_id` (uuid): Foreign key to `profiles.id`. The sender of the message.
- `content` (text): The message text.
- `created_at` (timestamptz)

**Example: Fetch messages for a chat**
```javascript
async function getMessages(chatId) {
  const { data, error } = await supabase
    .from('messages')
    .select(`
      *,
      sender:profiles(first_name, last_name)
    `)
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching messages:', error);
    return [];
  }
  
  return data;
}
```

## 4. Realtime Functionality

The application uses Supabase Realtime to listen for database changes and update the UI instantly.

- **New Trips:** The app subscribes to `INSERT` events on the `trips` table.
  - Channel name: `public:trips`
- **New Messages:** The app subscribes to `INSERT` events on the `messages` table, filtered by the current chat room.
  - Channel name: `messages:chat_id=eq.<chat_id>`

You can use this functionality in a dashboard to display live data.

**Example: Subscribe to new trips**
```javascript
const tripChannel = supabase.channel('public:trips')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'trips' },
    (payload) => {
      console.log('New trip posted:', payload.new);
      // Add the new trip to your UI
    }
  )
  .subscribe();

// To unsubscribe:
// supabase.removeChannel(tripChannel);
```

## 5. Edge Functions

The project uses Supabase Edge Functions for server-side logic, primarily for sending push notifications.

- **`send-message-notification`**:
    - **Purpose:** Sends a push notification to a user when they receive a new message.
    - **Trigger:** This function is invoked via the Supabase client from the mobile app after a new message is successfully inserted into the database.
    - **Payload:** It expects a payload containing the message details and the `receiver_id`.

If the dashboard needs to send notifications, it can invoke this function similarly.
```javascript
const { data, error } = await supabase.functions.invoke('send-message-notification', {
  body: {
    record: {
      // payload for the function
    }
  }
});
```
