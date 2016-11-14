// This loads the environment variables from the .env file
require('dotenv-extended').load();

var builder = require('botbuilder');
var restify = require('restify');

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

// Create chat bot
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});
var bot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());

// You can provide your own model by specifing the 'LUIS_MODEL_URL' environment variable
// This Url can be obtained by uploading or creating your model from the LUIS portal: https://www.luis.ai/
const LuisModelUrl = process.env.LUIS_MODEL_URL;

// Main dialog with LUIS
var recognizer = new builder.LuisRecognizer(LuisModelUrl);
var intents = new builder.IntentDialog({ recognizers: [recognizer] });

intents
    .matches('match.info', [
    function (session, args, next) {
       var teams = builder.EntityRecognizer.findAllEntities(args.entities, 'Team');
       
       session.dialogData.foundTeamnames = [];
       teams.forEach(function(team){
           session.dialogData.foundTeamnames.push(team.entity);
       });
       

       if (session.dialogData.foundTeamnames.length==0) {
           session.send("Sorry ich habe die Teams nicht mitbekommen.");
           builder.Prompts.text(session, "Nenn mir doch ein Team");
       } else {
           next();
       }
    },
    function (session, results, next) {
        if (results.response) {
            session.dialogData.foundTeamnames.push(results.response);
            
        } 
        if (session.dialogData.foundTeamnames.length==1){
            session.send("Du möchtest Spiele mit %s sehen", session.dialogData.foundTeamnames[0]);
            builder.Prompts.text(session, "Nenn mir bitte noch das zweite Team");
        }
        else {
            next();
        }
    },
    function (session, results, next) {
        if (results.response) {
            session.dialogData.foundTeamnames.push(results.response);
            next();        
        } 
        else {
            next();
        }
    },
    function (session, args, next) {
        var foundMatches = findMatches(session.dialogData.foundTeamnames[0], session.dialogData.foundTeamnames[1]);
        if (foundMatches.length>0){
             session.send('Ich habe folgende Spiele gefunden:'); 
            foundMatches.forEach(function (match){
                if (match.score1!=null){
                    session.send('%s - %s --> %d : %d',match.player1 ,match.player2, match.score1, match.score2);
                } else {
                    session.send('%s - %s',match.player1 ,match.player2);
                }
            });
        } else {
            session.send('Sorry, ich habe keine Spiele zwischen '+session.dialogData.foundTeamnames[0]+' und '+session.dialogData.foundTeamnames[1]+' gefunden:');
        }
        session.dialogData.foundTeamname = [];
           
    }
    ]
    );
    intents.matches('me.name',
    [
        function (session, args, next) {
            var team = builder.EntityRecognizer.findEntity(args.entities, 'Team');
            if (team){
                session.dialogData.me=team;
                session.send("Alles klar, Du bist %s", team);
            } else {
                session.send("Das habe ich nicht verstanden.");
            }
        }

    ]);
    intents.matches('Help', '/help');
/*
intents.onBegin(function (session, args, next) {
    session.dialogData.name = args.name;
    session.send("Hi %s...", args.name);
    next();
});
*/
intents.onDefault(builder.DialogAction.send("Oh nein. Das habe ich nicht verstanden."));


bot.dialog('/', intents);



// data
var fs = require('fs');
var matches = JSON.parse(fs.readFileSync('matches.json', 'utf8'));

var findMatches = function(team1, team2){
    var result = [];
    var t1 = team1.toLowerCase();
    var t2 = team2.toLowerCase();
    matches.forEach(function(match){
       
        
        if (
            (match.player1.toLowerCase().indexOf(t1)>=0 && match.player2.toLowerCase().indexOf(t2)>=0)
            || 
            (match.player2.toLowerCase().indexOf(t1)>=0 && match.player1.toLowerCase().indexOf(t2)>=0)
           ) {
                result.push(match);
            };
    });
    return result;
};

console.log("Tobias, Thorsten", findMatches("Tobias", "Thorsten"));