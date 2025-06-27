class BookingSystem {
    constructor() {
        this.selectedService = null;
        this.selectedVehicle = null;
        this.selectedDate = null;
        this.selectedTime = null;
        this.currentMonth = new Date();
        this.services = {};
        this.vehicles = {};
        this.bookedSlots = {};
        this.blockedDates = [];
        
        this.init();
    }

    async init() {
        await this.loadData();
        this.setupEventListeners();
        this.loadServiceFromURL();
        this.renderServiceOptions();
        this.renderVehicleOptions();
        this.renderCalendar();
    }

    async loadData() {
        try {
            const [servicesRes, vehiclesRes, blockedRes] = await Promise.all([
                fetch('/api/services'),
                fetch('/api/vehicles'),
                fetch('/api/blocked-dates')
            ]);
            
            this.services = await servicesRes.json();
            this.vehicles = await vehiclesRes.json();
            this.blockedDates = await blockedRes.json();
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    loadServiceFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const serviceParam = urlParams.get('service');
        if (serviceParam && this.services[serviceParam]) {
            this.selectedService = serviceParam;
        }
    }

    setupEventListeners() {
        document.getElementById('prevMonth').addEventListener('click', () => this.changeMonth(-1));
        document.getElementById('nextMonth').addEventListener('click', () => this.changeMonth(1));
        document.getElementById('bookingForm').addEventListener('submit', (e) => this.handleSubmit(e));
    }

    renderServiceOptions() {
        const container = document.getElementById('serviceOptions');
        container.innerHTML = '';

        Object.entries(this.services).forEach(([key, service]) => {
            const option = document.createElement('div');
            option.className = `service-option ${this.selectedService === key ? 'selected' : ''}`;
            option.innerHTML = `
                <h4>${service.name}</h4>
                <p>From $${service.startingPrice}</p>
            `;
            option.addEventListener('click', () => this.selectService(key));
            container.appendChild(option);
        });
    }

    renderVehicleOptions() {
        const container = document.getElementById('vehicleGrid');
        container.innerHTML = '';

        Object.entries(this.vehicles).forEach(([key, vehicle]) => {
            const option = document.createElement('div');
            option.className = `vehicle-option ${this.selectedVehicle === key ? 'selected' : ''}`;
            option.innerHTML = `
                <h4>${vehicle.name}</h4>
                <p>${vehicle.multiplier}x base price</p>
            `;
            option.addEventListener('click', () => this.selectVehicle(key));
            container.appendChild(option);
        });
    }

    selectService(serviceKey) {
        this.selectedService = serviceKey;
        this.renderServiceOptions();
        this.updateSummary();
    }

    selectVehicle(vehicleKey) {
        this.selectedVehicle = vehicleKey;
        this.renderVehicleOptions();
        this.updateSummary();
    }

    changeMonth(direction) {
        this.currentMonth.setMonth(this.currentMonth.getMonth() + direction);
        this.renderCalendar();
    }

    async renderCalendar() {
        const container = document.getElementById('calendar');
        const monthHeader = document.getElementById('currentMonth');
        
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        
        monthHeader.textContent = `${monthNames[this.currentMonth.getMonth()]} ${this.currentMonth.getFullYear()}`;
        
        container.innerHTML = '';
        
        // Add day headers
        const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        dayHeaders.forEach(day => {
            const header = document.createElement('div');
            header.className = 'calendar-day header';
            header.textContent = day;
            container.appendChild(header);
        });

        const firstDay = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth(), 1);
        const lastDay = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 0);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Add empty cells for days before the first day of the month
        for (let i = 0; i < firstDay.getDay(); i++) {
            const emptyDay = document.createElement('div');
            emptyDay.className = 'calendar-day disabled';
            container.appendChild(emptyDay);
        }

        // Add days of the month
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const date = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth(), day);
            const dateString = date.toISOString().split('T')[0];
            
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day';
            dayElement.textContent = day;
            
            // Check if date is in the past or today
            if (date < tomorrow) {
                dayElement.classList.add('past');
            }
            // Check if date is more than 30 days in advance
            else if (date > new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)) {
                dayElement.classList.add('disabled');
            }
            // Check if date is blocked
            else if (this.blockedDates.some(blocked => blocked.date === dateString)) {
                dayElement.classList.add('disabled');
            }
            // Check if it's Sunday (closed)
            else if (date.getDay() === 0) {
                dayElement.classList.add('disabled');
            }
            else {
                dayElement.addEventListener('click', () => this.selectDate(dateString));
                if (this.selectedDate === dateString) {
                    dayElement.classList.add('selected');
                }
            }
            
            container.appendChild(dayElement);
        }
    }

    async selectDate(dateString) {
        this.selectedDate = dateString;
        this.renderCalendar();
        await this.loadTimeSlots();
        this.updateSummary();
    }

    async loadTimeSlots() {
        const date = new Date(this.selectedDate);
        const dayOfWeek = date.getDay();
        
        let availableHours = [];
        
        // Monday-Thursday: 1:00 PM - 6:00 PM
        if (dayOfWeek >= 1 && dayOfWeek <= 4) {
            availableHours = [13, 14, 15, 16, 17]; // 1 PM to 5 PM (last slot at 5 PM)
        }
        // Friday-Saturday: 9:00 AM - 6:00 PM
        else if (dayOfWeek === 5 || dayOfWeek === 6) {
            availableHours = [9, 10, 11, 12, 13, 14, 15, 16, 17]; // 9 AM to 5 PM
        }

        // Load existing bookings for this date
        try {
            const response = await fetch(`/api/bookings/${this.selectedDate}`);
            const bookings = await response.json();
            this.bookedSlots[this.selectedDate] = bookings;
        } catch (error) {
            console.error('Error loading bookings:', error);
            this.bookedSlots[this.selectedDate] = [];
        }

        this.renderTimeSlots(availableHours);
        document.getElementById('timeSelection').style.display = 'block';
    }

    renderTimeSlots(availableHours) {
        const container = document.getElementById('timeSlots');
        container.innerHTML = '';

        availableHours.forEach(hour => {
            // Create 30-minute slots
            [0, 30].forEach(minutes => {
                const time = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                const slot = document.createElement('div');
                slot.className = 'time-slot';
                slot.textContent = this.formatTime(time);
                
                // Check if slot is available
                if (this.isSlotAvailable(time)) {
                    slot.addEventListener('click', () => this.selectTime(time));
                    if (this.selectedTime === time) {
                        slot.classList.add('selected');
                    }
                } else {
                    slot.classList.add('disabled');
                }
                
                container.appendChild(slot);
            });
        });
    }

    isSlotAvailable(time) {
        if (!this.selectedService || !this.selectedVehicle) return false;
        
        const service = this.services[this.selectedService];
        const vehicle = this.vehicles[this.selectedVehicle];
        const duration = Math.ceil(service.duration * vehicle.duration); // in minutes
        
        const bookings = this.bookedSlots[this.selectedDate] || [];
        const slotStart = new Date(`${this.selectedDate}T${time}`);
        const slotEnd = new Date(slotStart.getTime() + duration * 60000);
        
        // Check if this slot conflicts with existing bookings
        return !bookings.some(booking => {
            const bookingStart = new Date(`${booking.date}T${booking.time}`);
            const bookingEnd = new Date(bookingStart.getTime() + booking.duration * 60000);
            
            return (slotStart < bookingEnd && slotEnd > bookingStart);
        });
    }

    selectTime(time) {
        this.selectedTime = time;
        this.renderTimeSlots(this.getAvailableHours());
        this.updateSummary();
    }

    getAvailableHours() {
        const date = new Date(this.selectedDate);
        const dayOfWeek = date.getDay();
        
        if (dayOfWeek >= 1 && dayOfWeek <= 4) {
            return [13, 14, 15, 16, 17];
        } else if (dayOfWeek === 5 || dayOfWeek === 6) {
            return [9, 10, 11, 12, 13, 14, 15, 16, 17];
        }
        return [];
    }

    formatTime(time) {
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        return `${displayHour}:${minutes} ${ampm}`;
    }

    updateSummary() {
        const summaryContainer = document.getElementById('bookingSummary').querySelector('.summary-content');
        const submitBtn = document.getElementById('submitBtn');
        
        if (!this.selectedService || !this.selectedVehicle) {
            summaryContainer.innerHTML = '<p>Please select a service and vehicle to see pricing</p>';
            submitBtn.disabled = true;
            return;
        }

        const service = this.services[this.selectedService];
        const vehicle = this.vehicles[this.selectedVehicle];
        const basePrice = service.startingPrice;
        const totalPrice = Math.round(basePrice * vehicle.multiplier);
        const duration = Math.ceil(service.duration * vehicle.duration);
        
        let summaryHTML = `
            <div class="summary-item">
                <span>Service:</span>
                <span>${service.name}</span>
            </div>
            <div class="summary-item">
                <span>Vehicle:</span>
                <span>${vehicle.name}</span>
            </div>
            <div class="summary-item">
                <span>Base Price:</span>
                <span>$${basePrice}</span>
            </div>
            <div class="summary-item">
                <span>Vehicle Multiplier:</span>
                <span>${vehicle.multiplier}x</span>
            </div>
            <div class="summary-item">
                <span>Duration:</span>
                <span>${Math.round(duration / 60)} hours</span>
            </div>
        `;

        if (this.selectedDate) {
            summaryHTML += `
                <div class="summary-item">
                    <span>Date:</span>
                    <span>${new Date(this.selectedDate).toLocaleDateString()}</span>
                </div>
            `;
        }

        if (this.selectedTime) {
            summaryHTML += `
                <div class="summary-item">
                    <span>Time:</span>
                    <span>${this.formatTime(this.selectedTime)}</span>
                </div>
            `;
        }

        summaryHTML += `
            <div class="summary-item summary-total">
                <span>Total Price:</span>
                <span>$${totalPrice}</span>
            </div>
        `;

        summaryContainer.innerHTML = summaryHTML;
        
        // Enable submit button if all required fields are selected
        const canSubmit = this.selectedService && this.selectedVehicle && 
                         this.selectedDate && this.selectedTime;
        submitBtn.disabled = !canSubmit;
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const service = this.services[this.selectedService];
        const vehicle = this.vehicles[this.selectedVehicle];
        
        const booking = {
            service: this.selectedService,
            serviceName: service.name,
            vehicle: this.selectedVehicle,
            vehicleName: vehicle.name,
            date: this.selectedDate,
            time: this.selectedTime,
            duration: Math.ceil(service.duration * vehicle.duration),
            totalPrice: Math.round(service.startingPrice * vehicle.multiplier),
            firstName: formData.get('firstName'),
            lastName: formData.get('lastName'),
            email: formData.get('email'),
            phone: formData.get('phone')
        };

        // Show loading modal
        document.getElementById('loadingModal').style.display = 'flex';

        try {
            const response = await fetch('/api/book', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(booking)
            });

            const result = await response.json();
            
            document.getElementById('loadingModal').style.display = 'none';
            
            if (result.success) {
                document.getElementById('successModal').style.display = 'flex';
            } else {
                alert('Booking failed: ' + result.error);
            }
        } catch (error) {
            document.getElementById('loadingModal').style.display = 'none';
            alert('Booking failed: ' + error.message);
        }
    }
}

// Initialize booking system when page loads
document.addEventListener('DOMContentLoaded', () => {
    new BookingSystem();
});