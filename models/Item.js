import mongoose from "mongoose";

const itemSchema = new mongoose.Schema({

  vaultId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Vault", 
    required: true 
},
  fileUrl: { 
    type: String, 
    required: true 
},  // encrypted blob stored in Cloudinary/S3
  encKey: { 
    type: String, 
    required: true 
},   // AES key (encrypted with vault key)
  metadata: {
    name: String,
    type: String,
    size: Number
  }
}, { timestamps: true });

export default mongoose.model("Item", itemSchema);
