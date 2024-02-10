# MWB Connect - API

## Getting Started on development

### One time setup

* Install Redis
* Copy the `.env.example` file to `.env` and update the values as needed.


#### Migrations

```bash
# this will setup all the tables & seed some data
npm run migrate:up
```

#### for Mac users

```bash
brew install nvm
nvm use
```

### Run the development server

```bash
npm install
npm start

```


### How to use migrations

* To create a new migration file, run the following command: `npm run migrate:create <migration-name>`
* Then you will see three files created in migrations folder. You need to update the `up` and `down` sqls in the `*****-up.sql` and `*****-down.sql` files respectively. No need to change/update the `js` file.
* After that, you can run the migration using `npm run migrate` command.
* In case you want to revert the last migration, you can run `npm run migrate:down1` command.


## References

- <https://github.com/nvm-sh/nvm>
