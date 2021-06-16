import express from "express";
import cors from "cors";
import pg from "pg";
import joi from "joi";

const app = express();
app.use(cors());
app.use(express.json());

const { Pool } = pg;

const connection = new Pool({
  user: "bootcamp_role",
  password: "senha_super_hiper_ultra_secreta_do_role_do_bootcamp",
  host: "localhost",
  port: 5432,
  database: "boardcamp",
});

app.get("/categories", async (req, res) => {
  try {
    const categories = await connection.query("SELECT * FROM categories");

    res.send(categories.rows);
  } catch (err) {
    console.log(err.message);
    res.sendStatus(500);
  }
});

app.post("/categories", async (req, res) => {
  const name = req.body.name.trim();

  if (name === "") {
    return res.sendStatus(400);
  }

  try {
    const category = await connection.query(
      "SELECT * FROM categories WHERE name ILIKE $1",
      [name]
    );

    if (category.rows.length === 0) {
      await connection.query("INSERT INTO categories (name) VALUES ($1)", [
        name,
      ]);
      return res.sendStatus(200);
    } else {
      return res.sendStatus(409);
    }
  } catch (e) {
    console.log(e);
  }

  res.send(name);
});

app.listen(4000, () => {
  console.log("server running at port 4000");
});
