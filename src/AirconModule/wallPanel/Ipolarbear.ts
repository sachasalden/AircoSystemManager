import { Airconditioner } from '../custom_typings/entities';

interface Ipolarbear {
  updateAcPanels(airconditioner: Array<Airconditioner>): Airconditioner[];

  getDeviceId(): String;

}

export default Ipolarbear;