TUTORIAL.md
This is a tutorial for web development beginners looking to get started using Stylus as a tool to simplify the CSS writing process.
This guide will provide:
1. Installation Instructions
2. A basic guide on how to begin and get started using Stylus

   
Installation Instructions:
● Open up an IDE. It is recommended to use Visual Studio Code
● Locate the terminal
● In the terminal, you will install Node.js
- First, install Homebrew by running this command:
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
- Next, install Node.js by running this command: brew install node
● In the terminal, you will install Stylus
- In the terminal, run this command:
npm install stylus -g
- In the terminal, check the version to make sure installation was successful. Run the following command:
stylus --version


 Basic Guide on How to Get Started:
1. In Visual Studio Code, create a new file called stylusIntro.styl.
- Note that files you create using Stylus must end with the .styl syntax
for proper use during integration.
2. Create some variables for colors you would like to consistently use in your
program.
Example:
Color1 = #32cd32 (this will be a lime green color. It is the Hex Value)
3. Choose the font size and style you want to use in your program and create the variable.
Example:
chosen_font: 12px, Arial (this will be of size 12 and Arial style font)
4. Set the body style using the variables you have already created. Example:
body
font: chosen_font
color: color1


Compile the file to CSS:
● Now that you have a basic format, you want to be able to use this in your project. You will start by compiling it into a CSS file by running the following command in your terminal:
stylus stylusIntro.styl -o style.css

● In your HTML file you can link this CSS file by including the following line of code: <link rel="stylesheet" href="style.css">
Thank you for following along. I hope this beginner guide was helpful!
