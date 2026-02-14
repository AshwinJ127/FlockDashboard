// Supabase client and elements declarations (no immediate initialization)
let supabaseClient;
const supabaseUrl = 'https://fnmsbbtskyfwmcojqukc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZubXNiYnRza3lmd21jb2pxdWtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0NDcwNDYsImV4cCI6MjA2MTAyMzA0Nn0.vStl4iZ5Jpn_wOBEkhhl8x1tVOe17Faeb07gPdu2Q-s';

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
    fetchAndDisplayTripsByPickupLocationChart();
    fetchAndDisplayCumulativeUsersChart();
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
    const chartContainer = tripsPerWeekDiv.previousElementSibling; // Get the chart-container div
    const canvas = chartContainer.querySelector('#tripsPerWeekChart');
    const ctx = canvas.getContext('2d');

    // Clear previous chart if it exists
    if (window.tripsPerWeekChartInstance) {
        window.tripsPerWeekChartInstance.destroy();
    }

    chartContainer.style.display = 'block'; // Show chart container
    tripsPerWeekDiv.style.display = 'none'; // Hide list data

    try {
        const { data, error } = await supabaseClient
            .from('trips')
            .select('updated_at')
            .order('updated_at', { ascending: true });

        if (error) {
            console.error('Error fetching trips for analytics:', error);
            chartContainer.innerHTML = `<p class="error-message">Failed to load trips analytics: ${error.message}</p>`;
            return;
        }

        if (data.length === 0) {
            chartContainer.innerHTML = '<p class="loading-indicator">No trip data for analytics.</p>';
            return;
        }

        const tripsByWeek = {};
        data.forEach(trip => {
            if (!trip.updated_at) {
                console.warn('Skipping trip due to missing updated_at:', trip);
                return;
            }
            const date = new Date(trip.updated_at);
            if (isNaN(date.getTime())) {
                console.warn('Skipping trip due to invalid updated_at date:', trip);
                return;
            }
            const startOfWeek = new Date(date.setDate(date.getDate() - date.getDay()));
            startOfWeek.setHours(0, 0, 0, 0);
            const weekKey = startOfWeek.toISOString().split('T')[0];

            if (!tripsByWeek[weekKey]) {
                tripsByWeek[weekKey] = 0;
            }
            tripsByWeek[weekKey]++;
        });

        const sortedWeeks = Object.keys(tripsByWeek).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
        const chartLabels = sortedWeeks.map(weekKey => new Date(weekKey).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        const chartData = sortedWeeks.map(weekKey => tripsByWeek[weekKey]);

        window.tripsPerWeekChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartLabels,
                datasets: [{
                    label: 'New Trips',
                    data: chartData,
                    borderColor: '#2563eb', // Primary blue
                    backgroundColor: 'rgba(37, 99, 235, 0.2)', // Primary blue with transparency
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#0f172a' // text color
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(226, 232, 240, 0.2)' // border color with transparency
                        },
                        ticks: {
                            color: '#475569' // textSecondary color
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(226, 232, 240, 0.2)'
                        },
                        ticks: {
                            color: '#475569'
                        }
                    }
                }
            }
        });
        console.log('Trips per week chart displayed successfully.');

    } catch (err) {
        console.error('Unexpected error during trips per week fetch:', err);
        chartContainer.innerHTML = '<p class="error-message">An unexpected error occurred loading trips per week.</p>';
    }
}

// Function to fetch and display trips by pickup location as a Bar Chart
async function fetchAndDisplayTripsByPickupLocationChart() {
    const chartContainer = document.querySelector('#tripsByPickupChart').closest('.chart-container');
    const canvas = chartContainer.querySelector('#tripsByPickupChart');
    const ctx = canvas.getContext('2d');

    if (window.tripsByPickupChartInstance) {
        window.tripsByPickupChartInstance.destroy();
    }

    try {
        const { data: tripsData, error: tripsError } = await supabaseClient
            .from('trips')
            .select('pickup');

        if (tripsError) {
            console.error('Error fetching trips for pickup location chart:', tripsError);
            chartContainer.innerHTML = `<p class="error-message">Failed to load pickup location data: ${tripsError.message}</p>`;
            return;
        }

        if (tripsData.length === 0) {
            chartContainer.innerHTML = '<p class="loading-indicator">No trip data to analyze by pickup location.</p>';
            return;
        }

        const pickupCounts = {};
        tripsData.forEach(trip => {
            const location = trip.pickup || 'Unknown';
            pickupCounts[location] = (pickupCounts[location] || 0) + 1;
        });

        const sortedLocations = Object.keys(pickupCounts).sort((a, b) => pickupCounts[b] - pickupCounts[a]);
        const chartLabels = sortedLocations;
        const chartData = sortedLocations.map(location => pickupCounts[location]);

        window.tripsByPickupChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: chartLabels,
                datasets: [{
                    label: 'Number of Trips',
                    data: chartData,
                    backgroundColor: '#2563eb', // Primary blue
                    borderColor: '#1d4ed8', // primaryDark
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#0f172a'
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(226, 232, 240, 0.2)'
                        },
                        ticks: {
                            color: '#475569'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(226, 232, 240, 0.2)'
                        },
                        ticks: {
                            color: '#475569'
                        }
                    }
                }
            }
        });
        console.log('Trips by pickup location chart displayed successfully.');

    } catch (err) {
        console.error('Unexpected error during trips by pickup location fetch:', err);
        chartContainer.innerHTML = '<p class="error-message">An unexpected error occurred loading trips by pickup location.</p>';
    }
}

// Function to fetch and display users over time
// Function to fetch and display cumulative users over time as a Line Chart
async function fetchAndDisplayCumulativeUsersChart() {
    const chartContainer = document.querySelector('#cumulativeUsersChart').closest('.chart-container');
    const canvas = chartContainer.querySelector('#cumulativeUsersChart');
    const ctx = canvas.getContext('2d');

    if (window.cumulativeUsersChartInstance) {
        window.cumulativeUsersChartInstance.destroy();
    }

    try {
        const { data: profilesData, error: profilesError } = await supabaseClient
            .from('profiles')
            .select('created_at')
            .order('created_at', { ascending: true });

        if (profilesError) {
            console.error('Error fetching profiles for cumulative users chart:', profilesError);
            chartContainer.innerHTML = `<p class="error-message">Failed to load cumulative users data: ${profilesError.message}</p>`;
            return;
        }

        if (profilesData.length === 0) {
            chartContainer.innerHTML = '<p class="loading-indicator">No user data to analyze cumulatively.</p>';
            return;
        }

        const cumulativeUsers = [];
        const userDates = [];

        profilesData.forEach(profile => {
            if (!profile.created_at) {
                console.warn('Skipping profile due to missing created_at:', profile);
                return;
            }
            const date = new Date(profile.created_at);
            if (isNaN(date.getTime())) {
                console.warn('Skipping profile due to invalid created_at date:', profile);
                return;
            }
            userDates.push(date);
        });

        if (userDates.length === 0) {
            chartContainer.innerHTML = '<p class="loading-indicator">No valid user data to analyze cumulatively.</p>';
            return;
        }

        // Sort dates to ensure correct cumulative count
        userDates.sort((a, b) => a.getTime() - b.getTime());

        let count = 0;
        let currentDate = new Date(userDates[0].getFullYear(), userDates[0].getMonth(), 1); // Start of the first month
        let dateIndex = 0;

        // Populate cumulative data month by month
        while (dateIndex < userDates.length) {
            let nextMonth = new Date(currentDate);
            nextMonth.setMonth(nextMonth.getMonth() + 1);

            while (dateIndex < userDates.length && userDates[dateIndex] < nextMonth) {
                count++;
                dateIndex++;
            }
            cumulativeUsers.push({ date: new Date(currentDate), count: count });
            currentDate = nextMonth;
        }
        
        const chartLabels = cumulativeUsers.map(item => item.date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
        const chartData = cumulativeUsers.map(item => item.count);

        window.cumulativeUsersChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartLabels,
                datasets: [{
                    label: 'Cumulative Users',
                    data: chartData,
                    borderColor: '#2563eb', // Primary blue
                    backgroundColor: 'rgba(37, 99, 235, 0.2)', // Primary blue with transparency
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#0f172a'
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(226, 232, 240, 0.2)'
                        },
                        ticks: {
                            color: '#475569'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(226, 232, 240, 0.2)'
                        },
                        ticks: {
                            color: '#475569'
                        }
                    }
                }
            }
        });
        console.log('Cumulative users chart displayed successfully.');

    } catch (err) {
        console.error('Unexpected error during cumulative users fetch:', err);
        chartContainer.innerHTML = '<p class="error-message">An unexpected error occurred loading cumulative users.</p>';
    }
}

// Function to fetch and display users over time
async function fetchAndDisplayUsersOverTime() {
    const usersOverTimeDiv = document.getElementById('users-over-time-data');
    const chartContainer = usersOverTimeDiv.previousElementSibling; // Get the chart-container div
    const canvas = chartContainer.querySelector('#usersOverTimeChart');
    const ctx = canvas.getContext('2d');

    // Clear previous chart if it exists
    if (window.usersOverTimeChartInstance) {
        window.usersOverTimeChartInstance.destroy();
    }

    chartContainer.style.display = 'block'; // Show chart container
    usersOverTimeDiv.style.display = 'none'; // Hide list data

    try {
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('created_at')
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching profiles for analytics:', error);
            chartContainer.innerHTML = `<p class="error-message">Failed to load users analytics: ${error.message}</p>`;
            return;
        }

        if (data.length === 0) {
            chartContainer.innerHTML = '<p class="loading-indicator">No user data for analytics.</p>';
            return;
        }

        const usersByMonth = {};
        data.forEach(profile => {
            if (!profile.created_at) {
                console.warn('Skipping profile due to missing created_at:', profile);
                return;
            }
            const date = new Date(profile.created_at);
            if (isNaN(date.getTime())) {
                console.warn('Skipping profile due to invalid created_at date:', profile);
                return;
            }
            const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
            startOfMonth.setHours(0, 0, 0, 0);
            const monthKey = startOfMonth.toISOString().split('T')[0].substring(0, 7);

            if (!usersByMonth[monthKey]) {
                usersByMonth[monthKey] = 0;
            }
            usersByMonth[monthKey]++;
        });

        const sortedMonths = Object.keys(usersByMonth).sort();
        const chartLabels = sortedMonths.map(monthKey => {
            const [year, month] = monthKey.split('-');
            return new Date(year, month - 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
        });
        const chartData = sortedMonths.map(monthKey => usersByMonth[monthKey]);

        window.usersOverTimeChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartLabels,
                datasets: [{
                    label: 'New Users',
                    data: chartData,
                    borderColor: '#2563eb', // Primary blue
                    backgroundColor: 'rgba(37, 99, 235, 0.2)', // Primary blue with transparency
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#0f172a' // text color
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(226, 232, 240, 0.2)'
                        },
                        ticks: {
                            color: '#475569'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(226, 232, 240, 0.2)'
                        },
                        ticks: {
                            color: '#475569'
                        }
                    }
                }
            }
        });
        console.log('Users over time chart displayed successfully.');

    } catch (err) {
        console.error('Unexpected error during users over time fetch:', err);
        chartContainer.innerHTML = '<p class="error-message">An unexpected error occurred loading users over time.</p>';
    }
}