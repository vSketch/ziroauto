// Service images mapping
const serviceImages = {
    'basic-interior': './za_files/IMG_8007.jpeg',
    'basic-exterior': './za_files/IMG_8025.jpeg',
    'basic-combo': './za_files/IMG_8029.jpeg',
    'pro-interior': './za_files/IMG_8034.jpeg',
    'pro-exterior': './za_files/IMG_8035.jpeg',
    'pro-combo': './za_files/IMG_8026.jpeg'
};

// Load services from API
async function loadServices() {
    try {
        const response = await fetch('/api/services');
        const services = await response.json();
        
        const container = document.getElementById('servicesContainer');
        container.innerHTML = '';
        
        Object.entries(services).forEach(([key, service]) => {
            const serviceCard = createServiceCard(key, service);
            container.appendChild(serviceCard);
        });
    } catch (error) {
        console.error('Error loading services:', error);
    }
}

function createServiceCard(serviceKey, service) {
    const card = document.createElement('div');
    card.className = 'service-card';
    
    card.innerHTML = `
        <div class="service-image" style="background-image: url('${serviceImages[serviceKey]}')"></div>
        <div class="service-content">
            <h3 class="service-title">${service.name}</h3>
            <p class="service-price">Starting at $${service.startingPrice}</p>
            <p class="service-description">${service.description}</p>
            <a href="booking.html?service=${serviceKey}" class="book-btn">Book Now</a>
        </div>
    `;
    
    return card;
}

// Initialize page
document.addEventListener('DOMContentLoaded', loadServices);