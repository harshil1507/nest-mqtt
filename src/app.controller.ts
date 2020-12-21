import { Controller } from '@nestjs/common';
import {
  Ctx,
  MessagePattern,
  MqttContext,
  Payload,
} from '@nestjs/microservices';
import { ClientMqtt } from '@nestjs/microservices/client/client-mqtt';
import { asciiToTrytes, trytesToAscii } from '@iota/converter';
import * as Mam from '@iota/mam';
const mode = 'restricted';
const sideKey = 'VERYSECRETKEY';
const provider = 'https://nodes.devnet.iota.org';
const providerName = 'devnet';
const mamExplorerLink = 'https://utils.iota.org/mam';

let mamState = Mam.init(provider);
mamState = Mam.changeMode(mamState, mode, sideKey);

@Controller()
export class AppController {
  constructor() {}
  clientObject = new ClientMqtt({ url: 'mqtt:localhost:1883' }).createClient();

  publish = async packet => {
    // Create MAM message as a string of trytes
    const trytes = asciiToTrytes(JSON.stringify(packet));
    const message = Mam.create(mamState, trytes);

    // Save your new mamState
    mamState = message.state;
    // Attach the message to the Tangle
    await Mam.attach(message.payload, message.address, 3, 9);

    console.log('Published to IOTA', packet, '\n');
    return message.root;
  };

  @MessagePattern('message')
  async getNotifications(
    @Payload() data: number[],
    @Ctx() context: MqttContext,
  ) {
    const root = await this.publish({
      message: data,
      timestamp: new Date().toLocaleString(),
    });
    const result = await Mam.fetch(root, mode, sideKey);
    if (result instanceof Error) throw new Error(result.stack);
    result.messages.forEach(message =>
      console.log(
        'Fetched and parsed',
        JSON.parse(trytesToAscii(message)),
        '\n',
      ),
    );
    this.clientObject.publish('message_ack', `Message pubished to MAM. Verify with MAM Explorer:\n${mamExplorerLink}/${root}/${mode}/${sideKey.padEnd(81, '9')}/${providerName}\n`);
    console.log(`Published to MQTT ->  Topic: ${context.getTopic()}`, `Message : ${data}`);
    console.log(`Verify with MAM Explorer:\n${mamExplorerLink}/${root}/${mode}/${sideKey.padEnd(81, '9')}/${providerName}\n`)
    return;
  }
}
