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
        findMatches(session.dialogData.foundTeamnames[0], session.dialogData.foundTeamnames[1]).then(foundMatches =>{
            if (foundMatches.length>0){
                session.send('Ich habe folgende Spiele gefunden:'); 
                presentMatches(session, foundMatches);
            } else {
                session.send('Sorry, ich habe keine Spiele zwischen '+session.dialogData.foundTeamnames[0]+' und '+session.dialogData.foundTeamnames[1]+' gefunden:');
            }
            session.dialogData.foundTeamname = [];
        });
    }
    ]
    );
    intents.matches('match.mine', [
    function (session, args, next) {
     
        if (session.dialogData.me === null){
            builder.Prompts.text(session, "Sag mir doch bitte wie Dein Team heißt.");
        } else {
            next();
        }
    },
    function (session, results, next) {
        if (results.response) {
            session.dialogData.me = results.response;
            next();        
        } 
        else {
            next();
        }
    },
        function (session, args, next) {
           
        findMatches(session.dialogData.me).then(foundMatches =>{
            
            if (foundMatches.length>0){
                session.send('Ich habe folgende Spiele gefunden:'); 
                presentMatches(session, foundMatches);
            } else {
                session.send('Sorry, ich habe keine Spiele für Dich gefunden:');
            }
            
        });
    }
    ]);

var presentMatches = function(session, foundMatches){
    foundMatches.forEach(function (match){
                    if (match.scoreHome!=null){
                        session.send('%s - %s --> %d : %d',match.homeTeam ,match.awayTeam, match.scoreHome, match.scoreAway);
                    } else {
                        session.send('%s - %s',match.homeTeam ,match.awayTeam);
                    }
                });
};
    

    intents.matches('me.name',
    [
        function (session, args, next) {
            var team = builder.EntityRecognizer.findEntity(args.entities, 'Team');
            if (team){
                session.dialogData.me=team.entity;
                session.send("Alles klar, Du bist %s", session.dialogData.me);
            } else {
                session.send("Das habe ich nicht verstanden.");
            }
        }

    ]);

    intents.matches('league.standings',
    [
        function (session, args, next) {      
                session.send("Bald kann ich bestimmt auch die Tabelle anzeigen!");
        }
    ]);
        intents.matches('result.enter',
    [
        function (session, args, next) {      
                session.send("Bald kann ich bestimmt auch Ergebnisse eintragen!");
        }
    ]);
    intents.matches('conversation.thankyou',
    [
        function (session, args, next) {      
                session.send("Aber gerne doch!");
        }
    ]);
        intents.matches('conversation.hello',
    [
        function (session, args, next) {      
                session.send("Hallo, ich bin der Fifa Bot!");
                session.send("Frag mich doch was zur Fritz Fifa Liga!");
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
//var fs = require('fs');
//var matches = JSON.parse(fs.readFileSync('matches.json', 'utf8'));

var findMatches = function(team1, team2){
 return new Promise((resolve, reject) => {
       var result = [];
    var t1 = team1.toLowerCase();
    var t2 = team2!= null ? team2.toLowerCase() : null;
    getMatches().then(matchResult => {
        matchResult.matches.forEach(function(match){
       
        
        if (
            (match.homeTeam.toLowerCase().indexOf(t1)>=0 && (t2===null || match.awayTeam.toLowerCase().indexOf(t2)>=0))
            || 
            (match.awayTeam.toLowerCase().indexOf(t1)>=0 && (t2===null || match.homeTeam.toLowerCase().indexOf(t2)>=0))
           ) {
                result.push(match);
                };
        });

        // Resolve (or fulfill) the promise with data
        return resolve(result);
        });
    });
};

//console.log("Tobias, Thorsten", findMatches("Tobias", "Thorsten"));


const scrapeIt = require("scrape-it");

var getMatches = function(){
    return scrapeIt("http://www.meinspielplan.de/plan/JVt7Sv?a=dates", {
    matches: {
        listItem:"tr.select_matches", 
        data: {
            homeTeam:{
                selector: ".cell_2 a.team_link"
            },
            awayTeam:".cell_4 a.team_link",
            scoreHome:{ 
                selector:"div.dates_match_result",
                convert: result => result.indexOf(":")<0 ? null : parseInt(result.substring(0,result.indexOf(":")))
            },
            scoreAway:{ 
                selector:"div.dates_match_result",
                convert: result => result.indexOf(":")<0 ? null : parseInt(result.substring(result.indexOf(":")+1))
            }
        }
    }
  
})
};

// Test it.
getMatches().then(result => {
    console.log(result);
    matches = result.matches;
    findMatches("Tobias", "Thorsten").then(matches => {
        console.log("Tobias, Thorsten", matches);
    })
    
});