import { DataTypes } from "sequelize";
import { getSequelize } from "../sequelize.js";
import { User } from "./user.js";

const sequelize = getSequelize();

export const UserDetail = sequelize.define(
  "user_details",
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "app_users",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    preferences: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: "User preferences for AI behavior and personality",
    },
    personal_info: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: "Personal information for AI to understand user context",
    },
    conversation_history: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      comment: "Recent conversation history for context",
    },
    llm_model: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "gemini",
      comment: "Current LLM model: gemini, gpt, ollama, etc.",
    },
    llm_config: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: "LLM-specific configuration (model name, temperature, etc.)",
    },
    embedding_provider: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "gemini",
      comment: "Embedding provider: gemini or fastapi",
    },
    embedding_config: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: "Embedding-specific configuration",
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "user_details",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    underscored: true,
  }
);

// Define relationships
User.hasOne(UserDetail, {
  foreignKey: "user_id",
  as: "details",
});

UserDetail.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});
