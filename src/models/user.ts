import { DataTypes } from "sequelize";
import { getSequelize } from "../sequelize.js";

const sequelize = getSequelize();

export const User = sequelize.define(
  "app_users",
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    password_hash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    approved: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "app_users",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
    underscored: true,
  }
);
