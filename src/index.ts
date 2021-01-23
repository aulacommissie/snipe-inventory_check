#!/usr/bin/env node
import configstore from 'configstore'; // config
import { Snipe } from 'snipe-it.js';
import prompts from 'prompts';
import chalk from 'chalk';
import figlet from 'figlet';
import ora from 'ora';
import readline from 'readline';

const conf = new configstore('ginit');

const spinner = ora({
  color: 'blue',
  spinner: 'bouncingBall',
  text: 'Loading...'
});

async function asyncFunction() {
  console.clear();
  console.log(
    chalk.magenta(figlet.textSync('Snipe-IT\nInventory-check', { horizontalLayout: 'Default' }))
  );

  if (!conf.get('snipeURL')) {
    // Gets creds. from user and stores them in config
    await prompts([
      {
        type: 'text',
        name: 'snipeURL',
        message: "What's the URL of your Snipe-IT instance?"
      },
      {
        type: 'password',
        name: 'snipeToken',
        message: "What's your API token?"
      }
    ]).then(async (res) => {
      try {
        conf.set('snipeURL', res.snipeURL);
        conf.set('snipeToken', res.snipeToken);
      } catch (err) {
        console.log(
          `${chalk.red.italic.bold('Error')} - Can't save the credentials\nError: ${err}`
        );
      }
    });
  }

  const snipe = new Snipe(conf.get('snipeURL'), conf.get('snipeToken'));

  spinner.start('Fetching resources from Snipe-IT...');

  let assets;
  let categories;

  try {
    assets = await snipe.hardware.get({ limit: 10000 }); // retrieve all the assets
    categories = await snipe.categories.get({ limit: 10000 }); // retrieve all the categories
  } catch (err) {
    spinner.stop();
    console.log(
      `${chalk.red.italic.bold('Error')} - Can't fetch assets and/or locations.\n${chalk.bold.red(
        'Make sure that you have the correct permissions, URL and API token!'
      )}\nError: ${err}`
    );
    conf.clear();
    process.exit();
  }
  const assetArray: { title: string; value: any }[] = [];
  const categoriesArray: { title: string; value: any }[] = [];

  assets.forEach((hardware) => {
    assetArray.push({
      title: `${hardware.asset_tag} | ${hardware.name}`,
      value: hardware.id
    });
  });

  categories.forEach((category) => {
    categoriesArray.push({
      title: category.name,
      value: category.id
    });
  });

  assetArray.push({
    // add stop to assetArray
    title: 'Stop',
    value: 'stop'
  });

  categoriesArray.push({
    // add all to categoriesArray
    title: 'All',
    value: 'all'
  });

  let categoryID: any;

  spinner.stop();

  await prompts([
    {
      type: 'autocomplete',
      name: 'category',
      message: 'Category (All for checking all!)',
      choices: categoriesArray,
      limit: 15
    }
  ]).then(async (value) => {
    categoryID = value.category;
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  let x: boolean;
  x = true;
  // eslint-disable-next-line no-loops/no-loops
  while (x) {
    // eslint-disable-next-line no-await-in-loop
    await prompts([
      {
        type: 'autocomplete',
        name: 'AssetID',
        message: 'Asset Tag (Stop to stop!)',
        choices: assetArray,
        limit: 20
      }
      // eslint-disable-next-line no-loop-func
    ]).then(async (value) => {
      console.log(`"${value.AssetID}"`);
      if (value.AssetId === 'stop') {
        console.log('The following assets are missing:');
        console.log(assetArray);
        rl.question('Want to add these the status missing? (y/n)', (answer) => {
          if (answer.toLowerCase() === 'y') {
            console.log('added Missing status to assets');
            // add logic to add status to assets in array
            x = false;
          } else if (answer.toLowerCase() === 'n') {
            console.log('Cancelling...');
            x = false;
          } else {
            console.log('Please enter (y/n)');
          }
          rl.close();
        });
      } else {
        console.log('Hier moet nog logic komen, om entered asset uit array te halen');
        x = false;
      }
    });
  }

  // TODO
  // make user be able to enter asset tags and when they match remove from assetArray
  // In the end print which assets are missing
  // give them the label missing
  // Ask user if they have in fact entered everything? if not go back to entering asset tags
  // fix package.json to include correct dependencies
}

asyncFunction();
