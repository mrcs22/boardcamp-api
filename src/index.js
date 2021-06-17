import express from "express";
import cors from "cors";
import pg from "pg";

import Joi from "joi";

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

// ############# CATEGORIES ROUTES ###############

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
      return res.sendStatus(201);
    } else {
      return res.sendStatus(409);
    }
  } catch (e) {
    console.log(e);
  }
});

// ############# GAMES ROUTES ###############

app.get("/games", async (req, res) => {
  try {
    const searchedName = req.query.name ? `${req.query.name}%` : "%";

    const games = await connection.query(
      'SELECT g.*, c.name as "categoryName" FROM games g LEFT JOIN categories c ON "categoryId" = c.id WHERE g.name ILIKE $1;',
      [searchedName]
    );

    res.send(games.rows);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

app.post("/games", async (req, res) => {
  try {
    const categories = await connection.query("SELECT * FROM categories");
    const categoryIds = categories.rows.map((c) => c.id);

    const gameSchema = Joi.object({
      name: Joi.string().required(),
      image: Joi.string().allow(""),
      stockTotal: Joi.number().greater(0).required(),
      categoryId: Joi.number()
        .valid(...categoryIds)
        .required(),
      pricePerDay: Joi.number().greater(0).required(),
    });

    const validation = gameSchema.validate(req.body);

    if (!!validation.error) {
      console.log(validation.error.details[0].message);
      return res.sendStatus(400);
    }

    const { name, stockTotal, image, categoryId, pricePerDay } = req.body;

    const game = await connection.query(
      "SELECT * FROM games WHERE name ILIKE $1",
      [name]
    );

    if (game.rows.length === 0) {
      await connection.query(
        'INSERT INTO games (name, "stockTotal", image, "categoryId", "pricePerDay") VALUES ($1,$2,$3,$4,$5)',
        [name, stockTotal, image, categoryId, pricePerDay]
      );
      return res.sendStatus(201);
    }

    res.sendStatus(409);
  } catch (err) {
    console.log(err.message);
    res.sendStatus(500);
  }
});
// #############  CUSTOMER ROUTES  ###############
app.get("/customers", async (req, res) => {
  try {
    const searchedCpf = req.query.cpf ? `${req.query.cpf}%` : "%";

    const customers = await connection.query(
      "SELECT * FROM customers WHERE cpf ILIKE $1;",
      [searchedCpf]
    );

    res.send(customers.rows);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});
// ############# STARTING SERVER  ###############

app.listen(4000, () => {
  console.log("server running at port 4000");
});
