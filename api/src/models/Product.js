const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ProductSchema = new Schema({
    sku: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: String,
    type: { type: String, enum: ['Wardrobe', 'Storage'], required: true },
    price: {
        amount: { type: Number, required: true },
        currency: { type: String, default: 'INR' }
    },
    inventory: {
        quantity: { type: Number, default: 0 },
        reserved: { type: Number, default: 0 }
    },
    reviews: {
        averageRating: { type: Number, default: 0 },
        totalReviews: { type: Number, default: 0 },
        ratingDistribution: {
            1: { type: Number, default: 0 },
            2: { type: Number, default: 0 },
            3: { type: Number, default: 0 },
            4: { type: Number, default: 0 },
            5: { type: Number, default: 0 }
        }
    },
    categories: [{ type: String }],
    attributes: {
        collection: { type: String, required: true },
        material: String,
        color: {
            family: String,
            shade: String
        },
        dimensions: {
            length: Number,
            width: Number,
            height: Number,
            unit: { type: String, enum: ['mm', 'cm', 'inch'], default: 'cm' }
        },
        configuration: String
    },
    designer: {
        name: String,
        royalty: Number
    },
    images: [{
        url: String,
        altText: String,
        isPrimary: Boolean
    }],
    tags: [String],
    features: [String]
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

ProductSchema.index({ sku: 1 });
ProductSchema.index({ name: 'text', description: 'text' });
ProductSchema.index({ 'price.amount': 1 });
ProductSchema.index({ categories: 1 });
ProductSchema.index({ tags: 1 });
ProductSchema.index({ 'attributes.color.family': 1 });
ProductSchema.index({ 'attributes.configuration': 1 });
ProductSchema.index({
    type: 1,
    'attributes.configuration': 1,
    'attributes.color.family': 1,
    'price.amount': 1
});
ProductSchema.index({ 'attributes.collection': 1 });
ProductSchema.methods.updateReviewStats = async function (newRating, oldRating = null) {
    const update = {};
    const inc = oldRating ? 0 : 1; // If oldRating exists, we're updating an existing review

    update.$inc = {
        'reviews.totalReviews': inc,
        [`reviews.ratingDistribution.${newRating}`]: 1
    };

    if (oldRating) {
        update.$inc[`reviews.ratingDistribution.${oldRating}`] = -1;
    }

    const result = await this.model('Product').findOneAndUpdate(
        { _id: this._id },
        update,
        { new: true }
    );

    const totalRatings = Object.values(result.reviews.ratingDistribution).reduce((a, b) => a + b, 0);
    const weightedSum = Object.entries(result.reviews.ratingDistribution)
        .reduce((sum, [rating, count]) => sum + (Number(rating) * count), 0);

    result.reviews.averageRating = totalRatings > 0 ? weightedSum / totalRatings : 0;
    await result.save();
};
const Product = mongoose.model('Product', ProductSchema);

module.exports = Product;