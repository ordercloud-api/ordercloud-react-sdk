# Contributing to ordercloud-react-sdk

Hello! Thanks for your interest in contributing! Before implementing new features and changes please create an issue so we can have a discussion about it!

## Installing Commitizen

This project uses commitizen to standardize commits and simplify the release process.  Please visit the [commitizen docs](https://commitizen-tools.github.io/commitizen/#installation) for instructions on how to install commitizen on your local machine.

## Creating Commits With Commitizen

1. Open a powershell terminal and navigate to your project path `cd /path/to/this/folder`
2. Stage your commits
3. Run the command `cz commit` and follow the prompts

## Submitting a Pull Request

1. Fork this repository
2. Create a new branch with the name of the feature you plan to work on
3. Install dependencies
4. Make your changes
5. Run `npm run build` to compile the code.
6. Verify your changes work as expected. Run `npm install /path/to/this/folder` (or `npm link`) in a different project to install locally and test
7. Commit your changes using commitizen. See [Creating Commits With Commitizen](#creating-commits-with-commitizen)
8. Create a pull request to main

## Releasing

Assuming you or a contributor followed the instructions for [submitting a pull request](#submitting-a-pull-request) and are a maintainer you can follow these instructions to release a new version of the sdk.

1. Review and merge the pull request
2. A commitizen workflow action will create a tag and github release, then publish the new version of npm. Verify that these steps have completed in GH actions upon merging of the PR.
