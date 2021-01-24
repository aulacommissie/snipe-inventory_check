#!/usr/bin/env node
import configstore from 'configstore'; // config
import { Snipe, StatusLabel } from 'snipe-it.js';
import prompts from 'prompts';
import chalk from 'chalk';
import figlet from 'figlet';
import ora from 'ora';

const conf = new configstore('snipe-api');

const spinner = ora({
  color: 'blue',
  spinner: 'bouncingBall',
  text: 'Loading...'
});

async function asyncFunction() {
  console.clear();
  console.log(
    chalk.magenta(figlet.textSync('Snipe-IT\nInventory-check', { horizontalLayout: 'default' }))
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
  let status;

  try {
    assets = await snipe.hardware.get({ limit: 10000 }); // retrieve all the assets
    categories = await snipe.categories.get({ limit: 10000 }); // retrieve all the categories
    status = await snipe.statuslabels.get({ limit: 10000 }); // retrieve all statuses
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

  let assetArray: { title: string; value: number | string | null; category: string }[] = [];
  const categoriesArray: { title: string; value: number | string | null }[] = [];
  const statusArray: { title: string; value: number | string | null }[] = [];
  console.log(statusArray);

  assets.forEach((hardware) => {
    assetArray.push({
      title: `${hardware.asset_tag} | ${hardware.name}`,
      value: hardware.id,
      category: hardware.category.id
    });
  });

  categories.forEach((category) => {
    categoriesArray.push({
      title: category.name,
      value: category.id
    });
  });

  status.forEach((StatusLabel) => {
    statusArray.push({
      title: StatusLabel.name,
      value: StatusLabel.id
    });
  });

  console.log(statusArray);
  assetArray.push({
    // add stop to assetArray
    title: 'Stop',
    value: 'stop',
    category: 'stop'
  });

  categoriesArray.push({
    // add all to categoriesArray
    title: 'All',
    value: 'all'
  });

  statusArray.push({
    title: 'Add "Missing"',
    value: 'add'
  });

  let categoryID: number | string;

  spinner.stop();

  await prompts([
    {
      type: 'autocomplete',
      name: 'status',
      message: 'Choose which statuslabel to use for missing, else choose "Add Missing"',
      choices: statusArray,
      limit: 10
    }
  ]);

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

  if (categoryID !== 'all') {
    assetArray = assetArray.filter(
      (array) => array.category === categoryID || array.category === 'stop'
    );
  }

  let x: boolean;
  x = true;
  // eslint-disable-next-line no-loops/no-loops
  while (x) {
    // eslint-disable-next-line no-await-in-loop
    const question = await prompts([
      {
        type: 'autocomplete',
        name: 'AssetID',
        message: 'Asset Tag (Stop to stop!)',
        choices: assetArray,
        limit: 20
      }
    ]);

    if (question.AssetID === 'stop') {
      console.log('The following assets are missing:');
      console.log(assetArray);

      // eslint-disable-next-line no-await-in-loop
      const response = await prompts({
        type: 'select',
        name: 'StopChoice',
        message: 'Choose an option',
        choices: [
          { title: 'Cancel without saving', value: 'stop' },
          { title: 'I forgot to remove an asset', value: 'cancel' },
          { title: 'Give these assets the category "Missing"', value: 'save' }
        ],
        initial: 1
      });
      if (response.StopChoice === 'stop') {
        console.log('Stopping...');
        x = false;
      } else if (response.StopChoice === 'cancel') {
        console.log('Returning back to asset changing');
        question.AssetID = null;
      } else if (response.StopChoice === 'save') {
        console.log('Giving assets status "Missing"');
        spinner.start('Sending requests to Snipe-IT');
        spinner.stop();
      }

      // Ask if user is certain these are missing
      // Ask if not go back to the input prompt
      // If correct give them the status missing + quit script
      // If cancel stop without saving
    } else {
      assetArray = assetArray.filter((array) => array.value !== question.AssetID);
    }
  }

  // TODO
  // give them the label missing
  // Ask user if they have in fact entered everything? if not go back to entering asset tags
  // fix package.json to include correct dependencies
}

asyncFunction();
