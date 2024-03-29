import React from 'react'
import Form from './Form';
import { Switch, Route, Redirect } from 'react-router-dom';
import { encryptAES_CBC, decryptAES_CBC } from './AESUtils'
import FileForm from './FileForm';
const NodeRSA = require('node-rsa');

export default class Main extends React.Component {
    constructor(props) {
        super(props);

        const key = new NodeRSA().generateKeyPair(512)
        key.setOptions({ encryptionScheme: 'pkcs1' });

        this.state = {
            loggedUser: {
                login: "",
                password: "",
            },
            file: {
                fileName: null,
                content: null,
            },
            publicKey: null,
            privateKey: null,
            token: null,
            iv: null,
            rsa: key,
            loggedIn: false
        }
    }

    /* --- Communication with API --- */
    async fetchFile(fileName) {

        const body = {
            fileName: this.encryptAES(fileName)
        }

        const response = await fetch("http://localhost:9001/api/get/file", {
            headers: {
                'Content-Type': 'application/json',
            },
            method: "POST",
            body: JSON.stringify(body)
        })

        const json = await response.json();

        if (response.status === 200) {
            const text = json.text;

            console.log("Successfully requested encrypted text")

            const decr = this.decryptAES(text);

            console.log("Succesfully decrypted reqeusted cipher text")

            let file = this.state.file;
            file.content = decr;

            this.setState({
                file: file
            });
        } else {
            alert(json.message)
        }

    }

    async onSubmit() {

        const publicKey = this.state.publicKey;
        if (publicKey) {

            const body = {
                key: publicKey
            };

            const response = await fetch("http://localhost:9001/auth/token/request", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body)
            });

            const json = await response.json();

            console.log("Successfully requested encrypted token");

            const token = json.token;
            const iv = json.iv;

            const decryptedToken = this.decryptToken(token, iv);

            console.log("Successfully decrypted token");

            this.setState({
                token: decryptedToken.token,
                iv: decryptedToken.iv
            });

            const authData = this.encryptLoginAndPassword();

            console.log("Successfully encrypted creds");

            const authResponse = await fetch("http://localhost:9001/api/auth", {
                headers: {
                    'Content-Type': 'application/json',
                },
                method: "POST",
                body: JSON.stringify(authData)
            })

            const authJson = await authResponse.json();

            const responseCode = authResponse.status

            if (responseCode === 200) {
                alert(authJson.message)
                this.setState({
                    loggedIn: true
                });
            } else {
                alert(authJson.message)
            }

            console.log("Login finished with " + responseCode + " code")

        } else {
            alert('No public key generated');

        }

    }
    /* --- */

    /* --- Handling input's value changes --- */
    handleValueChange(event) {
        event.preventDefault();
        const inputName = event.target.name;
        const inputValue = event.target.value;

        const user = this.state.loggedUser;

        user[inputName] = inputValue;

        console.log(inputName + ": " + user[inputName])

        this.setState({
            loggedUser: user
        });
    }

    handleFileNameChange(event) {
        event.preventDefault();
        const inputName = event.target.name;
        const inputValue = event.target.value;

        let file = this.state.file;

        file[inputName] = inputValue;

        this.setState({
            file: file
        });
    }
    /* --- */

    /* --- RSA keys generation and RSA decryption --- */
    generateKeys() {

        const publicKey = this.state.rsa.exportKey("pkcs1-public-pem");
        const privateKey = this.state.rsa.exportKey("pkcs8-private-pem");

        this.setState({
            publicKey: publicKey,
            privateKey: privateKey
        })
    }

    decryptToken(token, iv) {
        const decryptedToken = {
            token: this.state.rsa.decrypt(token, 'utf8'),
            iv: this.state.rsa.decrypt(iv, 'utf8')
        }

        return decryptedToken;
    }
    /* --- */

    /* --- AES CBC encryption and decryption --- */
    encryptLoginAndPassword() {
        let login = this.state.loggedUser.login;
        let password = this.state.loggedUser.password;
        let key = this.state.token;
        let iv = this.state.iv;

        login = encryptAES_CBC(key, iv, login);
        password = encryptAES_CBC(key, iv, password);

        const encryptedCreds = {
            login: login,
            password: password
        };

        return encryptedCreds;
    }

    decryptAES(text) {

        let key = this.state.token;
        let iv = this.state.iv;

        const dect = decryptAES_CBC(key, iv, text)

        return dect;
    }

    encryptAES(text) {

        let key = this.state.token;
        let iv = this.state.iv;

        const encr = encryptAES_CBC(key, iv, text);

        return encr;
    }
    /* --- */

    render() {

        const rsaPublicKey = this.state.publicKey;

        return (
            <div className="container">

                <div className="row">

                    <Switch>
                        <Route exact path="/">
                            {
                                this.state.loggedIn ? <Redirect to="/form/file" /> :
                                    <div className="col-md-12">
                                        <div className="py-5 text-center">
                                            <h2>Secure database for text files</h2>
                                            <p className="lead">Authorization</p>
                                        </div>
                                        <Form
                                            onBlur={(event) => this.handleValueChange(event)}
                                            onSubmit={() => this.onSubmit()}
                                            getKeys={() => this.generateKeys()}
                                            rsaKey={rsaPublicKey} />
                                    </div>
                            }
                        </Route>
                        <Route path="/form/file">
                            {
                                !this.state.loggedIn ? <Redirect to="/" /> :
                                    <div className="col-md-12">
                                        <div className="py-5 text-center">
                                            <h2>Secure database for text files</h2>
                                            <p className="lead">Requesting file</p>
                                        </div>
                                        <FileForm
                                            file={this.state.file}
                                            onBlur={(event) => this.handleFileNameChange(event)}
                                            onSubmit={(filename) => this.fetchFile(filename)}
                                        />
                                    </div>
                            }
                        </Route>
                    </Switch>
                </div>
            </div >
        )
    }
}