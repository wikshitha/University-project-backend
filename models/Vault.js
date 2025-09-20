import mongoose from "mongoose";

const vaultSchema = new mongoose.Schema({

  ownerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
},
  title: {
     type: String, 
     required: true 
    },
  description: String,

  // linked rules
  ruleSetId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "RuleSet" 
},

  // encrypted items
  items: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Item" 
}],

  // sealed keys for participants
  sealedKeys: [{
    participantId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User" 
    },
    encKey: { 
        type: String, 
        required: true 
    }
  }]
}, { timestamps: true });

export default mongoose.model("Vault", vaultSchema);
