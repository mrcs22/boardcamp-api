import express from "express";
import cors from "cors";
import dayjs from "dayjs";
import pg from "pg";
pg.types.setTypeParser(1082, (str) => str);

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
      image: Joi.string().allow("").required(),
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

const customerSchema = Joi.object({
  name: Joi.string().required(),
  phone: Joi.string()
    .pattern(/^[0-9]{10,11}$/)
    .required(),
  cpf: Joi.string()
    .pattern(/^[0-9]{11}$/)
    .required(),
  birthday: Joi.date().iso().less("now"),
});

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

app.get("/customers/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const customer = await connection.query(
      "SELECT * FROM customers WHERE id = $1;",
      [id]
    );

    if (customer.rows.length === 0) {
      return res.sendStatus(400);
    }

    res.send(customer.rows[0]);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

app.post("/customers", async (req, res) => {
  try {
    const validation = customerSchema.validate(req.body);

    if (!!validation.error) {
      return res.sendStatus(400);
    }

    const { name, phone, cpf, birthday } = req.body;

    const customer = await connection.query(
      "SELECT * FROM customers WHERE cpf LIKE $1",
      [cpf]
    );

    if (customer.rows.length !== 0) {
      return res.sendStatus(409);
    }

    await connection.query(
      "INSERT INTO customers (name,phone,cpf,birthday) VALUES ($1,$2,$3,$4)",
      [name, phone, cpf, birthday]
    );

    res.sendStatus(200);
  } catch (err) {
    console.log(err.message);
    res.sendStatus(500);
  }
});

app.put("/customers/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const validation = customerSchema.validate(req.body);

    if (!!validation.error) {
      console.log(validation.error.details);
      return res.sendStatus(400);
    }

    const { name, phone, cpf, birthday } = req.body;

    const customer = await connection.query(
      "SELECT * FROM customers WHERE cpf LIKE $1 AND id <> $2",
      [cpf, id]
    );

    if (customer.rows.length !== 0) {
      return res.sendStatus(409);
    }

    await connection.query(
      "UPDATE customers SET name = $1, phone = $2, cpf = $3, birthday=$4 WHERE id = $5",
      [name, phone, cpf, birthday, id]
    );

    res.sendStatus(200);
  } catch (err) {
    console.log(err.message);
    res.sendStatus(500);
  }
});

// #############  RENTAL ROUTES  ###############

app.get("/rentals", async (req, res) => {
  const { customerId, gameId } = req.query;
  const isThereQueryParams = !!customerId || !!gameId;
  let statement = "";
  let dependences = [];

  if (isThereQueryParams) {
    if (!!customerId && !!gameId) {
      statement = 'WHERE r."customerId" = $1 AND r."gameId" = $2';
      dependences = [customerId, gameId];
    } else {
      statement = `WHERE r.${!!customerId ? '"customerId"' : '"gameId"'} = $1`;
      dependences = [customerId ? customerId : gameId];
    }
  }

  try {
    let rentals = await connection.query(
      `
      SELECT r.*, c.name as customer_name, g.name as game_name, g."categoryId", categories.name as "categoryName"
      FROM
      rentals r JOIN customers c
      ON r."customerId" = c.id
      JOIN games g
      ON g.id = r."gameId"
      JOIN categories
      ON categories.id = g."categoryId"
    ${statement}
      `,
      dependences
    );

    rentals = rentals.rows.map((r) => {
      const {
        id,
        customerId,
        gameId,
        rentDate,
        daysRented,
        returnDate,
        originalPrice,
        delayFee,
        categoryId,
        categoryName,
      } = r;

      return {
        id,
        customerId,
        gameId,
        rentDate,
        daysRented,
        returnDate,
        originalPrice,
        delayFee,
        customer: {
          id: customerId,
          name: r.customer_name,
        },
        game: {
          id: gameId,
          name: r.game_name,
          categoryId,
          categoryName,
        },
      };
    });

    res.send(rentals);
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});

app.post("/rentals", async (req, res) => {
  const { customerId, gameId, daysRented } = req.body;
  try {
    const game = await connection.query("SELECT * FROM games WHERE id = $1", [
      gameId,
    ]);

    const unreturnedGames = await connection.query(
      `SELECT * FROM rentals WHERE "gameId" = $1 AND "returnDate" is null`,
      [gameId]
    );

    const isThereSufficientGames =
      unreturnedGames.rows.length < game.rows[0].stockTotal;

    const customer = await connection.query(
      "SELECT * FROM customers WHERE id = $1",
      [customerId]
    );

    const isCustomerIdAndGameIdValids =
      !!game.rows.length && !!customer.rows.length;

    const isDaysRentedValid = daysRented > 0;

    if (
      isCustomerIdAndGameIdValids &&
      isThereSufficientGames &&
      isDaysRentedValid
    ) {
      const dateNow = dayjs().format("YYYY-MM-DD");

      const { pricePerDay } = game.rows[0];
      const originalPrice = daysRented * pricePerDay;

      await connection.query(
        `
    INSERT INTO rentals
    ("customerId", "gameId","rentDate","daysRented","returnDate","originalPrice","delayFee")
    VALUES
    ($1,$2,$3,$4,$5,$6,$7)
    `,
        [customerId, gameId, dateNow, daysRented, null, originalPrice, null]
      );

      res.sendStatus(201);
    } else {
      res.sendStatus(400);
    }
  } catch (err) {
    res.sendStatus(500);
  }
});

app.post("/rentals/:id/return", async (req, res) => {
  const { id } = req.params;
  try {
    const rentals = await connection.query(
      `SELECT rentals.*, games."pricePerDay" 
      FROM rentals JOIN games
      ON rentals."gameId" = games.id
      WHERE rentals.id = $1`,
      [id]
    );
    const rental = rentals.rows[0];

    if (!!rental.returnDate) {
      return res.sendStatus(400);
    }

    if (rentals.rows.length !== 0) {
      const returnDate = dayjs().format("YYYY-MM-DD");

      const daysDiff =
        dayjs(returnDate).diff(rental.rentDate, "d") - rental.daysRented;
      const delayFee = daysDiff > 0 ? daysDiff * rental.pricePerDay : null;

      await connection.query(
        `
    UPDATE rentals 
    SET "delayFee" = $1, "returnDate" = $2
    WHERE id = $3
    `,
        [delayFee, returnDate, id]
      );

      return res.sendStatus(200);
    }

    return res.sendStatus(404);
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});

app.delete("/rentals/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const rentals = await connection.query(
      `SELECT * FROM rentals WHERE id = $1`,
      [id]
    );

    if (rentals.rows.length === 0) {
      return sendStatus(404);
    }

    if (!!rentals.rows[0].returnDate) {
      return res.sendStatus(400);
    }

    await connection.query("DELETE FROM rentals WHERE id = $1", [id]);
    res.sendStatus(200);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

// ############# STARTING SERVER ###############

app.listen(4000, () => {
  console.log("server running at port 4000");
});
