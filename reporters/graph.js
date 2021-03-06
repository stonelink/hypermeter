var Q = require('q');
var log = require('loglevel');

exports.create = function(config) {
    var dataPoints = [];

    var plotly = require('plotly')(config.username, config.apiKey);
    var plot = Q.nbind(plotly.plot, plotly);

    var plotTraces = function(existingTraces) {
        var updatedTraces = [];
        var updatedTraceKeys = [];
        var newTraces = [];

        dataPoints.forEach(function(dataPoint) {
            var existingTraceIndex = existingTraces.indexOf(dataPoint.name);
            if (existingTraceIndex !== -1) {
                updatedTraces.push(dataPoint);
                updatedTraceKeys.push(existingTraceIndex);
            } else {
                newTraces.push(dataPoint);
            }
        });

        var layout = {
            xaxis: {
                type: 'linear',
                title: 'Build'
            },
            yaxis: {
                title: 'Response time (ms)'
            }
        };

        var plotNewTraces = function() {
            if (newTraces.length) {
                log.debug('Writing new traces...');
                return plot(newTraces, {
                    layout: layout,
                    filename: config.filename,
                    fileopt: existingTraces.length ? 'append' : 'overwrite'
                });
            } else {
                return Q('Done');
            }
        };

        if (updatedTraces.length) {
            log.debug('Writing updated traces...');
            return plot(updatedTraces, {
                layout: layout,
                filename: config.filename,
                fileopt: 'extend',
                traces: updatedTraceKeys
            }).then(function() {
                return plotNewTraces();
            });
        } else {
            return plotNewTraces();
        }
    }

    var createNewGraph = function() {
        return plot({}, { filename: config.filename, fileopt: 'overwrite' })
        .then(function(response) {
            log.warn('No fileId specified, created new graph ' + response.url);
            return plotTraces([]);
        });
    }

    return {
        report: function(url, response, time, success) {
            if (success) {
                dataPoints.push({
                    x: config.build,
                    y: time,
                    name: url,
                    line: {shape: "spline"},
                    type: 'scatter'
                });
            }
        },
        summarise: function(passes, failures) {
            log.debug('Graph summarise...');
            if (config.fileId) {
                return Q.ninvoke(plotly, "getFigure", config.username, config.fileId)
                .then(function(figure) {
                    return figure.data.map(function(trace) { return trace.name; });
                })
                .then(plotTraces);
            } else {
                return createNewGraph();
            }
        }
    };
}
