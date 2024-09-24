const express = require('express');
const router = express.Router();
const Wishlist = require('../models/WhishList');
const Product = require('../models/Product');
const passport = require('passport');
const mongoose = require('mongoose');
const jwt = require("jsonwebtoken")

// Middleware to get or create wishlist
const getWishlist = async (req, res, next) => {
    try {
        let wishlist = await Wishlist.findOne({ user: req.user._id });
        if (!wishlist) {
            wishlist = new Wishlist({ user: req.user._id, products: [] });
            await wishlist.save();
        }
        req.wishlist = wishlist;
        next();
    } catch (error) {
        res.status(500).json({ message: 'Error fetching wishlist', error: error.message });
    }
};

// Get user's wishlist
router.get('/', passport.authenticate('jwt', { session: false }), getWishlist, async (req, res) => {
    try {
        const populatedWishlist = await Wishlist.findById(req.wishlist._id).populate('products');
        res.json(populatedWishlist);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching wishlist', error: error.message });
    }
});

// Add product to wishlist
router.post('/add', passport.authenticate('jwt', { session: false }), getWishlist, async (req, res) => {
    try {
        const { productId } = req.body;
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ message: 'Invalid product ID' });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        if (!req.wishlist.products.includes(productId)) {
            req.wishlist.products.push(productId);
            await req.wishlist.save();
        }

        res.json({ message: 'Product added to wishlist', wishlist: req.wishlist });
    } catch (error) {
        res.status(500).json({ message: 'Error adding product to wishlist', error: error.message });
    }
});

// Remove product from wishlist
router.delete('/remove/:productId', passport.authenticate('jwt', { session: false }), getWishlist, async (req, res) => {
    try {
        const { productId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ message: 'Invalid product ID' });
        }

        req.wishlist.products = req.wishlist.products.filter(id => id.toString() !== productId);
        await req.wishlist.save();

        res.json({ message: 'Product removed from wishlist', wishlist: req.wishlist });
    } catch (error) {
        res.status(500).json({ message: 'Error removing product from wishlist', error: error.message });
    }
});

// Clear wishlist
router.post('/clear', passport.authenticate('jwt', { session: false }), getWishlist, async (req, res) => {
    try {
        req.wishlist.products = [];
        await req.wishlist.save();
        res.json({ message: 'Wishlist cleared', wishlist: req.wishlist });
    } catch (error) {
        res.status(500).json({ message: 'Error clearing wishlist', error: error.message });
    }
});

module.exports = router;