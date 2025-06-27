const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');
const ical = require('ical-generator');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.'));

// In-memory storage (in production, use a database)
let bookings = [];
let blockedDates = [];

// Email configuration (you'll need to set up your email credentials)
const transporter = nodemailer.createTransporter({
  service: 'gmail', // or your email service
  auth: {
    user: 'your-email@gmail.com', // Replace with your email
    pass: 'your-app-password' // Replace with your app password
  }
});

// Service configurations
const services = {
  'basic-interior': {
    name: 'Basic Interior',
    startingPrice: 75,
    duration: 120, // minutes
    description: 'Complete interior cleaning and detailing'
  },
  'basic-exterior': {
    name: 'Basic Exterior',
    startingPrice: 85,
    duration: 120,
    description: 'Exterior wash, wax, and tire shine'
  },
  'basic-combo': {
    name: 'Basic Interior & Exterior',
    startingPrice: 140,
    duration: 180,
    description: 'Complete interior and exterior detailing'
  },
  'pro-interior': {
    name: 'Pro Interior',
    startingPrice: 150,
    duration: 240,
    description: 'Premium interior detailing with protection'
  },
  'pro-exterior': {
    name: 'Pro Exterior',
    startingPrice: 175,
    duration: 240,
    description: 'Premium exterior detailing with ceramic coating'
  },
  'pro-combo': {
    name: 'Pro Interior & Exterior',
    startingPrice: 300,
    duration: 360,
    description: 'Complete premium detailing package'
  }
};

// Vehicle pricing multipliers
const vehicleMultipliers = {
  'sedan': { multiplier: 1.0, name: 'Sedan/Coupe', duration: 1.0 },
  'suv': { multiplier: 1.3, name: 'SUV/Crossover', duration: 1.2 },
  'truck': { multiplier: 1.4, name: 'Pickup Truck', duration: 1.3 },
  'van': { multiplier: 1.5, name: 'Van/Minivan', duration: 1.4 },
  'luxury': { multiplier: 1.6, name: 'Luxury Vehicle', duration: 1.3 },
  'work-truck': { multiplier: 3.0, name: 'Work Truck/Commercial', duration: 8.0 }
};

// API Routes
app.get('/api/services', (req, res) => {
  res.json(services);
});

app.get('/api/vehicles', (req, res) => {
  res.json(vehicleMultipliers);
});

app.get('/api/bookings/:date', (req, res) => {
  const date = req.params.date;
  const dayBookings = bookings.filter(booking => booking.date === date);
  res.json(dayBookings);
});

app.get('/api/blocked-dates', (req, res) => {
  res.json(blockedDates);
});

app.post('/api/block-date', (req, res) => {
  const { date, reason } = req.body;
  blockedDates.push({ date, reason, blocked: true });
  res.json({ success: true });
});

app.delete('/api/block-date/:date', (req, res) => {
  const date = req.params.date;
  blockedDates = blockedDates.filter(blocked => blocked.date !== date);
  res.json({ success: true });
});

app.post('/api/book', async (req, res) => {
  try {
    const booking = req.body;
    booking.id = Date.now().toString();
    booking.createdAt = new Date().toISOString();
    
    bookings.push(booking);

    // Send confirmation email
    await sendConfirmationEmail(booking);
    
    res.json({ success: true, bookingId: booking.id });
  } catch (error) {
    console.error('Booking error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

async function sendConfirmationEmail(booking) {
  const service = services[booking.service];
  const vehicle = vehicleMultipliers[booking.vehicle];
  
  // Create calendar event
  const calendar = ical({
    domain: 'ziroauto.com',
    name: 'Z Auto Service Booking'
  });

  const startDate = new Date(`${booking.date}T${booking.time}`);
  const endDate = new Date(startDate.getTime() + (booking.duration * 60000));

  calendar.createEvent({
    start: startDate,
    end: endDate,
    summary: `${service.name} - Z Auto Service`,
    description: `Vehicle: ${vehicle.name}\nService: ${service.name}\nTotal: $${booking.totalPrice}`,
    location: 'Z Auto Service, Spartanburg, SC',
    organizer: {
      name: 'Z Auto Service',
      email: 'info@ziroauto.com'
    }
  });

  const mailOptions = {
    from: 'info@ziroauto.com',
    to: booking.email,
    subject: 'Z Auto Service - Booking Confirmation',
    html: `
      <h2>Booking Confirmation</h2>
      <p>Dear ${booking.firstName} ${booking.lastName},</p>
      <p>Your booking has been confirmed!</p>
      
      <h3>Booking Details:</h3>
      <ul>
        <li><strong>Service:</strong> ${service.name}</li>
        <li><strong>Vehicle:</strong> ${vehicle.name}</li>
        <li><strong>Date:</strong> ${booking.date}</li>
        <li><strong>Time:</strong> ${booking.time}</li>
        <li><strong>Duration:</strong> ${Math.round(booking.duration / 60)} hours</li>
        <li><strong>Total Price:</strong> $${booking.totalPrice}</li>
      </ul>
      
      <p>We look forward to serving you!</p>
      <p>Best regards,<br>Z Auto Service Team</p>
    `,
    attachments: [{
      filename: 'booking.ics',
      content: calendar.toString(),
      contentType: 'text/calendar'
    }]
  };

  await transporter.sendMail(mailOptions);
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});