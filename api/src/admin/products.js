const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const passport = require('passport');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const Whishlist = require('../models/WhishList');
// Middleware to check if the user is an admin
const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
    }
    next();
};

// Get all products
router.get('/', passport.authenticate("jwt", { session: false }), isAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 10, search, type, collection, minPrice, maxPrice } = req.query;
        const query = {};

        if (search) query.$text = { $search: search };
        if (type) query.type = type;
        if (collection) query['attributes.collection'] = collection;
        if (minPrice || maxPrice) {
            query['price.amount'] = {};
            if (minPrice) query['price.amount'].$gte = Number(minPrice);
            if (maxPrice) query['price.amount'].$lte = Number(maxPrice);
        }

        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

        const products = await Product.find(query)
            .skip((page - 1) * limit)
            .limit(Number(limit));

        res.json({
            products,
            totalPages,
            totalProducts,
            currentPage: page,
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching products', error: error.message });
    }
});

// Create a new product (admin only)
router.post('/', passport.authenticate('jwt', { session: false }), isAdmin, async (req, res) => {
    try {
        const product = new Product(req.body);
        await product.save();
        res.status(201).json(product);
    } catch (error) {
        res.status(400).json({ message: 'Error creating product', error: error.message });
    }
});

async function sendPriceChangeEmail(user, product, oldPrice, newPrice) {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_ADDRESS,
                pass: process.env.EMAIL_PASSWORD
            }
        });

        const mailOptions = {
            from: process.env.EMAIL_ADDRESS,
            to: user.email,
            subject: "Price Change Alert for Wishlisted Product",
            html: `
            <html>
              <body>
                <h1>Price Change Alert</h1>
                <p>Dear ${user.name},</p>
                <p>The price of "${product.name}" in your wishlist has changed.</p>
                <p>Old Price: ${oldPrice} ${product.price.currency}</p>
                <p>New Price: ${newPrice} ${product.price.currency}</p>
                <p>Visit our website to check out the updated price!</p>
              </body>
            </html>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Price change email sent: ', info.response);
    } catch (error) {
        console.error('Error sending price change email:', error);
    }
}

// Update a product (admin only)
// Update a product (admin only)
router.put('/:id', passport.authenticate('jwt', { session: false }), isAdmin, async (req, res) => {
    try {
        const oldProduct = await Product.findById(req.params.id);
        if (!oldProduct) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const oldPrice = oldProduct.price.amount;
        const newPrice = req.body.price.amount;

        const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });

        // Check if price has changed
        if (oldPrice !== newPrice) {
            // Find all wishlists containing this product
            const wishlists = await Whishlist.find({ products: req.params.id });

            // Send email to each user
            for (let wishlist of wishlists) {
                const user = await User.findById(wishlist.user);
                if (user && user.email) {
                    await sendPriceChangeEmail(user, product, oldPrice, newPrice);
                }
            }
        }

        res.json(product);
    } catch (error) {
        res.status(400).json({ message: 'Error updating product', error: error.message });
    }
});

// Delete a product (admin only)
router.delete('/:id', passport.authenticate('jwt', { session: false }), isAdmin, async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting product', error: error.message });
    }
});

module.exports = router;

/*

POST /products
{
  "name": "New Product",
  "description": "This is a new product",
  "price": 19.99,
  "category": "Electronics"
}

PUT /products/123456789
{
  "name": "Updated Product",
  "description": "This is an updated product",
  "price": 24.99,
  "category": "Electronics"
}

DELETE /products/123456789

*/