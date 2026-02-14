// Supabase client and elements declarations (no immediate initialization)
let supabaseClient;
const supabaseUrl = 'https://fnmsbbtskyfwmcojqukc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZubXNiYnRza3lmd21jb2pxdWtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0NDcwNDYsImexA2MTAyMzA0Nn0.vStl4iZ5Jpn_wOBEkhhl8x1tVOe17Faeb07gPdu2Q-s';

const tripListDiv = document.getElementById('trip-list');
const refreshButton = document.getElementById('refresh-button');
const loadingIndicator = document.getElementById('loading-indicator');
const errorMessage = document.getElementById('error-message');

// Function to format date and time
function formatDateTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Function to fetch and display trips
async function fetchAndDisplayTrips() {
    if (!supabaseClient) {
        console.error('Supabase client is not available. Cannot fetch trips.');
        errorMessage.textContent = 'Supabase client failed to initialize. Check console for details.';
        errorMessage.style.display = 'block';
        return;
    }

    loadingIndicator.style.display = 'block';
    errorMessage.style.display = 'none';
    tripListDiv.innerHTML = ''; // Clear previous trips
    console.log('Fetching trips...');

    try {
        // Step 1: Fetch trips data, including the user_id
        const { data: tripsData, error: tripsError } = await supabaseClient
            .from('trips')
            .select(`*, user_id`) // Select all trip fields and the user_id
            .gt('departure_time', new Date().toISOString())
            .order('departure_time', { ascending: true });

        if (tripsError) {
            console.error('Error fetching trips from Supabase:', tripsError);
            console.error('Supabase Error Details:', tripsError);
            errorMessage.textContent = `Failed to load trips. Error: ${tripsError.message || JSON.stringify(tripsError)}. Please try again.`;
            errorMessage.style.display = 'block';
            return;
        }

        console.log('Trips data received:', tripsData);

        if (tripsData.length === 0) {
            tripListDiv.innerHTML = '<p class="loading-indicator">No upcoming trips found.</p>';
            console.log('No upcoming trips found.');
            return;
        }

        // Step 2: For each trip, fetch the corresponding driver profile
        const tripsWithDrivers = await Promise.all(tripsData.map(async trip => {
            const { data: profileData, error: profileError } = await supabaseClient
                .from('profiles')
                .select('first_name, last_name')
                .eq('id', trip.user_id)
                .single(); // Expecting one profile per user_id

            if (profileError && profileError.code !== 'PGRST116') { // PGRST116 means no rows found (e.g., deleted profile), not a critical error for display
                console.warn(`Could not fetch profile for user_id ${trip.user_id}:`, profileError);
                return { ...trip, driver: { first_name: 'Unknown', last_name: 'Driver' } };
            }

            return { ...trip, driver: profileData || { first_name: 'Unknown', last_name: 'Driver' } };
        }));

        tripsWithDrivers.forEach(trip => {
            const tripCard = document.createElement('div');
            tripCard.classList.add('card');
            tripCard.innerHTML = `
                <h3>${trip.pickup} to ${trip.dropoff}</h3>
                <p><strong>Departure:</strong> ${formatDateTime(trip.departure_time)}</p>
                <p><strong>Seats Available:</strong> ${trip.seats}</p>
                <p><strong>Driver:</strong> <span class="driver">${trip.driver.first_name} ${trip.driver.last_name}</span></p>
                ${trip.ask ? `<p><strong>Suggested Price:</strong> $${trip.ask}</p>` : ''}
            `;
            tripListDiv.appendChild(tripCard);
        });
        console.log('Trips displayed successfully.');

    } catch (err) {
        console.error('Unexpected error during trip fetch:', err);
        errorMessage.textContent = 'An unexpected error occurred while fetching trips.';
        errorMessage.style.display = 'block';
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

// Event listener for the refresh button
refreshButton.addEventListener('click', () => {
    fetchAndDisplayTrips();
    fetchAndDisplayTripsPerWeek();
    fetchAndDisplayUsersOverTime();
});

// Initial setup and fetch when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded. Initializing Supabase client...');
    if (window.supabase && typeof window.supabase.createClient === 'function') {
        supabaseClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
        console.log('Supabase client initialized successfully.');
        fetchAndDisplayTrips(); // Fetch initial trips
        fetchAndDisplayTripsPerWeek(); // Fetch initial trips per week
        fetchAndDisplayUsersOverTime(); // Fetch initial users over time
    } else {
        console.error('Supabase createClient function not found. Ensure the Supabase CDN script is loaded correctly in index.html.');
        errorMessage.textContent = 'Supabase client failed to initialize. Please check console for details.';
        errorMessage.style.display = 'block';
    }
});

// Function to fetch and display new trips posted per week
async function fetchAndDisplayTripsPerWeek() {
    const tripsPerWeekDiv = document.getElementById('trips-per-week-data');
    tripsPerWeekDiv.innerHTML = '<p class="loading-indicator">Loading trips per week...</p>';

    try {
        const { data, error } = await supabaseClient
            .from('trips')
            .select('created_at')
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching trips for analytics:', error);
            tripsPerWeekDiv.innerHTML = `<p class="error-message">Failed to load trips analytics: ${error.message}</p>`;
            return;
        }

        if (data.length === 0) {
            tripsPerWeekDiv.innerHTML = '<p class="loading-indicator">No trip data for analytics.</p>';
            return;
        }

        const tripsByWeek = {};
        data.forEach(trip => {
            const date = new Date(trip.created_at);
            // Get the start of the week (Sunday)
            const startOfWeek = new Date(date.setDate(date.getDate() - date.getDay()));
            startOfWeek.setHours(0, 0, 0, 0); // Normalize to start of day
            const weekKey = startOfWeek.toISOString().split('T')[0]; // YYYY-MM-DD format for key

            if (!tripsByWeek[weekKey]) {
                tripsByWeek[weekKey] = 0;
            }
            tripsByWeek[weekKey]++;
        });

        const sortedWeeks = Object.keys(tripsByWeek).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

        let html = '<ul>';
        sortedWeeks.forEach(weekKey => {
            html += `<li><strong>Week of ${new Date(weekKey).toLocaleDateString()}:</strong> <span>${tripsByWeek[weekKey]} new trips</span></li>`;
        });
        html += '</ul>';
        tripsPerWeekDiv.innerHTML = html;
        console.log('Trips per week displayed successfully.');

    } catch (err) {
        console.error('Unexpected error during trips per week fetch:', err);
        tripsPerWeekDiv.innerHTML = '<p class="error-message">An unexpected error occurred loading trips per week.</p>';
    }
}

// Function to fetch and display users over time
async function fetchAndDisplayUsersOverTime() {
    const usersOverTimeDiv = document.getElementById('users-over-time-data');
    usersOverTimeDiv.innerHTML = '<p class="loading-indicator">Loading users over time...</p>';

    try {
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('updated_at') // Using updated_at as created_at is not explicitly mentioned for profiles, and backend.md uses it.
            .order('updated_at', { ascending: true });

        if (error) {
            console.error('Error fetching profiles for analytics:', error);
            usersOverTimeDiv.innerHTML = `<p class="error-message">Failed to load users analytics: ${error.message}</p>`;
            return;
        }

        if (data.length === 0) {
            usersOverTimeDiv.innerHTML = '<p class="loading-indicator">No user data for analytics.</p>';
            return;
        }

        const usersByMonth = {};
        data.forEach(profile => {
            const date = new Date(profile.updated_at);
            // Get the start of the month
            const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
            startOfMonth.setHours(0, 0, 0, 0);
            const monthKey = startOfMonth.toISOString().split('T')[0].substring(0, 7); // YYYY-MM format

            if (!usersByMonth[monthKey]) {
                usersByMonth[monthKey] = 0;
            }
            usersByMonth[monthKey]++;
        });

        const sortedMonths = Object.keys(usersByMonth).sort();

        let html = '<ul>';
        sortedMonths.forEach(monthKey => {
            const [year, month] = monthKey.split('-');
            const monthName = new Date(year, month - 1).toLocaleString('en-US', { month: 'long' });
            html += `<li><strong>${monthName} ${year}:</strong> <span>${usersByMonth[monthKey]} new users</span></li>`;
        });
        html += '</ul>';
        usersOverTimeDiv.innerHTML = html;
        console.log('Users over time displayed successfully.');

    } catch (err) {
        console.error('Unexpected error during users over time fetch:', err);
        usersOverTimeDiv.innerHTML = '<p class="error-message">An unexpected error occurred loading users over time.</p>';
    }
}