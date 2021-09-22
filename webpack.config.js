const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const ImageMinimizerPlugin = require("image-minimizer-webpack-plugin");
const { extendDefaultPlugins } = require("svgo");
const CopyWebpackPlugin = require('copy-webpack-plugin');

const dev = process.env.NODE_ENV === 'development';

const userConfig = require('./frontend/config.json');
for (const b in userConfig.bundles) {
    if (userConfig.bundles.hasOwnProperty(b)) {
        userConfig.bundles[b] = `./frontend/${userConfig.bundles[b]}`;
    }
}

const config = {
    entry: userConfig.bundles,
    output: {
        path: path.resolve(__dirname, 'resources/useless-js'), // Temporary until webpack stops emitting js for css files
        filename: '[name].js'
    },
    devtool: dev ? 'eval-source-map' : undefined,
    target: "electron-renderer",
    module: {
        rules: [
            {
                test: /\.js$/i,
                use: [
                    {
                        loader: 'babel-loader',
                        options: {
                            presets: ['@babel/preset-env'],
                        }
                    }
                ]
            },
            {
                test: /\.s[ac]ss$/i,
                use: [
                    {
                        loader: MiniCssExtractPlugin.loader,
                    },
                    'css-loader',
                    'sass-loader',
                ]
            },
            {
                test: /\.(woff2?|eot|ttf|otf)$/i,
                type: 'asset/resource',
                generator: {
                    filename: '../fonts/[name][ext]',
                },
            },
            {
                test: /\.(png|jpe?g|gif|svg)$/i,
                type: 'asset/resource',
                generator: {
                    filename: '../images/[name][ext]',
                },
            },
            {
                test: /\.ts$/i,
                use: {
                    loader: 'ts-loader',
                    options: {
                        configFile: 'tsconfig.frontend.json',
                    }
                },
                exclude: '/node_modules/',
            },
            {
                test: /\.html$/i,
                type: 'asset/resource',
                generator: {
                    filename: '../[name][ext]',
                },
            }
        ],
    },
    plugins: [
        new MiniCssExtractPlugin({
            filename: '../css/[name].css',
        }),
        new CopyWebpackPlugin({
            patterns: [
                {from: 'node_modules/@fortawesome/fontawesome-free/svgs', to: '../images/icons'}
            ]
        }),
        new ImageMinimizerPlugin({
            minimizerOptions: {
                // Lossless optimization with custom option
                // Feel free to experiment with options for better result for you
                plugins: [
                    ["gifsicle", {}],
                    ["mozjpeg", {}],
                    ["pngquant", {}],
                    // Svgo configuration here https://github.com/svg/svgo#configuration
                    [
                        "svgo",
                        {
                            plugins: extendDefaultPlugins([
                                {
                                    name: "removeViewBox",
                                    active: false,
                                },
                                {
                                    name: "addAttributesToSVGElement",
                                    params: {
                                        attributes: [{ xmlns: "http://www.w3.org/2000/svg" }],
                                    },
                                },
                            ]),
                            //TODO for imagemin-svgo ^10.0.0 when https://github.com/webpack-contrib/image-minimizer-webpack-plugin/issues/237 is fixed
                            // plugins: {
                            //     name: 'preset-default',
                            //     params: {
                            //         overrides: {
                            //             removeViewBox: {
                            //                 active: false,
                            //             },
                            //             addAttributesToSVGElement: {
                            //                 params: {
                            //                     attributes: [{ xmlns: "http://www.w3.org/2000/svg" }],
                            //                 },
                            //             },
                            //         },
                            //     },
                            // },
                        },
                    ],
                ],
            },
        }),
    ]
};

module.exports = config;
