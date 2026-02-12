import { Airconditioner } from '../../../../custom_typings/entities';

interface Ipolarbear {
  updateAcPanels(airconditioners: Array<Airconditioner>): Airconditioner[];

  getDeviceId(): String;
}

export default Ipolarbear;
